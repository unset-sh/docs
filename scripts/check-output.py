"""Check rendered pages and their local assets; runtime JS remains constrained by CSP.

HTMLParser uses decoded attributes, so entities cannot disguise URL schemes.
https://docs.python.org/3/library/html.parser.html
"""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import stat
from urllib.parse import unquote, urljoin, urlsplit

POLICY = {
    'default-src': {"'none'"}, 'script-src': {"'self'"}, 'style-src': {"'self'"},
    'img-src': {"'self'", 'data:'}, 'connect-src': {"'self'"}, 'font-src': {"'self'"},
    'manifest-src': {"'self'"}, 'base-uri': {"'none'"}, 'form-action': {"'none'"},
}
FORBIDDEN_TAGS = {'style', 'base', 'iframe', 'frame', 'object', 'embed', 'form'}


class PageParser(HTMLParser):
    def __init__(self, path, is_page=True):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.is_page = is_page
        self.ids = set()
        self.references = []
        self.policies = []
        self.robots = []
        self.in_head = False
        self.in_script = False

    def reject(self, message):
        raise ValueError(f'{self.path}: {message}')

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if len(attrs) != len(attributes):
            self.reject('Duplicate attributes')
        if tag in FORBIDDEN_TAGS:
            self.reject(f'Forbidden <{tag}> element')
        if any(name == 'style' or name.startswith('on') or name == 'srcdoc' for name in attrs):
            self.reject('Inline style or executable attribute')
        if tag == 'head':
            self.in_head = True
        identifier = attrs.get('id') or (attrs.get('name') if tag == 'a' else None)
        if identifier:
            if identifier in self.ids:
                self.reject(f'Duplicate id: {identifier}')
            self.ids.add(identifier)
        if tag == 'script':
            if not attrs.get('src'):
                self.reject('Inline script')
            self.in_script = True
        if tag == 'meta':
            equiv = attrs.get('http-equiv', '').lower()
            if equiv == 'refresh':
                self.reject('Refresh redirects are not permitted')
            if equiv == 'content-security-policy':
                if not self.in_head:
                    self.reject('CSP must be in the document head')
                self.policies.append(attrs.get('content', ''))
            if attrs.get('name', '').lower() == 'robots':
                self.robots.append(attrs.get('content', ''))
        for name in ('src', 'poster', 'background', 'href', 'xlink:href', 'action', 'formaction', 'data'):
            if name not in attrs:
                continue
            value = attrs[name] or ''
            resource = not (tag == 'a' and name == 'href')
            self.references.append((value, resource, tag == 'img' and name == 'src'))
        if 'srcset' in attrs:
            # Source sets in this site use file URLs. Data URLs remain supported by img/src.
            if 'data:' in attrs['srcset']:
                self.reject('Use img/src for data images, not srcset')
            for item in attrs['srcset'].split(','):
                parts = item.split()
                if not parts or len(parts) > 2:
                    self.reject('Malformed srcset')
                self.references.append((parts[0], True, False))
        if 'ping' in attrs:
            self.reject('Link pings are not permitted')

    def handle_startendtag(self, tag, attributes):
        self.handle_starttag(tag, attributes)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False
        if tag == 'script':
            self.in_script = False

    def handle_data(self, text):
        if self.in_script and text.strip():
            self.reject('Inline script content')

    def verify_policy(self):
        if not self.is_page:
            return
        if len(self.policies) != 1:
            self.reject('Every page requires exactly one CSP')
        directives = {}
        for directive in self.policies[0].split(';'):
            parts = directive.split()
            if not parts:
                continue
            if parts[0] in directives:
                self.reject('Duplicate CSP directive')
            directives[parts[0]] = set(parts[1:])
        if directives != POLICY:
            self.reject('CSP must match the same-origin policy, including font-src self and no inline/eval')
        robots = [set(re.split(r'[\s,]+', value.strip().lower())) for value in self.robots]
        if len(robots) != 1 or robots[0] != {'noindex', 'nofollow'}:
            self.reject('Every page requires noindex, nofollow')


def destination(root, origin, source, value, resource=False, allow_data=False):
    if any(ord(char) < 32 for char in value) or '\\' in value:
        raise ValueError(f'{source}: Unsafe URL {value!r}')
    parsed = urlsplit(value)
    if parsed.scheme == 'data':
        if allow_data and value.lower().startswith('data:image/'):
            return None
        raise ValueError(f'{source}: Data resource refused: {value[:50]}')
    if parsed.scheme and parsed.scheme not in {'http', 'https'}:
        if not resource and parsed.scheme in {'mailto', 'tel'}:
            return None
        raise ValueError(f'{source}: Unsafe URL scheme: {value}')
    decoded = unquote(parsed.path)
    if '\\' in decoded or any(part == '..' for part in decoded.split('/')) and parsed.path.startswith('/'):
        raise ValueError(f'{source}: Unsafe URL path: {value}')
    page_url = '/' + source.as_posix()
    if page_url.endswith('/index.html'):
        page_url = page_url[:-10]
    absolute = urlsplit(urljoin(origin + page_url, value))
    expected = urlsplit(origin)
    if (absolute.scheme, absolute.netloc) != (expected.scheme, expected.netloc):
        if resource:
            raise ValueError(f'{source}: External resource: {value}')
        return None
    target = root / unquote(absolute.path).lstrip('/')
    if target.is_dir():
        target /= 'index.html'
    if not target.is_file():
        raise ValueError(f'{source}: Missing local destination: {value}')
    if not target.resolve().is_relative_to(root):
        raise ValueError(f'{source}: Destination escapes output: {value}')
    return target.relative_to(root), unquote(absolute.fragment).split(':~:text=')[0]


def section_names(value):
    if not isinstance(value, list) or not value or any(
        not isinstance(name, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', name)
        for name in value
    ):
        raise ValueError('Publication requires a non-empty list of safe section names')
    return value


def brand_files(directory):
    root = Path(directory)
    if not stat.S_ISDIR(root.lstat().st_mode):
        raise ValueError(f'Brand directory must be regular and unlinked: {root}')
    files = {}
    for path in sorted(root.rglob('*')):
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            continue
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError(f'Brand file must be regular and unlinked: {path}')
        files[path.relative_to(root)] = path.read_bytes()
    return files


def verify_brand_output(root, brand_dir):
    expected = brand_files(brand_dir)
    actual = brand_files(root / '_brand')
    if Path('provenance.json') not in expected:
        raise ValueError('Verified brand tree requires provenance.json')
    if actual.keys() != expected.keys():
        raise ValueError('Brand output file set differs from verified assets')
    for name, content in expected.items():
        if actual[name] != content:
            raise ValueError(f'Brand output differs from verified asset: {name}')


def check_output(directory, base_url='https://docs.unset.sh/', require_sections=None, brand_dir=None):
    if require_sections is not None:
        section_names(require_sections)
    root = Path(directory).resolve()
    if not root.is_dir():
        raise ValueError(f'Output directory missing: {root}')
    if brand_dir is not None:
        verify_brand_output(root, brand_dir)
    origin_parts = urlsplit(base_url)
    if origin_parts.scheme not in {'http', 'https'} or not origin_parts.netloc or origin_parts.path not in {'', '/'}:
        raise ValueError('Base URL must be an HTTP(S) origin at the site root')
    origin = f'{origin_parts.scheme}://{origin_parts.netloc}'
    pages = {}
    references = []
    files = sorted(root.rglob('*'))
    for path in files:
        info = path.lstat()
        relative = path.relative_to(root)
        if stat.S_ISLNK(info.st_mode) or stat.S_ISREG(info.st_mode) and info.st_nlink > 1:
            raise ValueError(f'Output link refused: {relative}')
        if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
            raise ValueError(f'Output special file refused: {relative}')
        if relative.parts[0] == 'unset':
            raise ValueError('Legacy unset/ app pages must not be published')
        if not path.is_file():
            continue
        if path.suffix in {'.html', '.svg'}:
            parser = PageParser(relative, path.suffix == '.html')
            parser.feed(path.read_text(encoding='utf-8'))
            parser.close()
            parser.verify_policy()
            pages[relative] = parser
            references.extend((relative, *reference) for reference in parser.references)
        elif path.suffix == '.css':
            css = re.sub(r'/\*.*?\*/', '', path.read_text(encoding='utf-8'), flags=re.S)
            for match in re.finditer(r'url\(\s*([\'"]?)(.*?)\1\s*\)', css, re.I):
                references.append((relative, match[2].strip(), True, True))
            for match in re.finditer(r'@import\s+[\'"]([^\'"]+)[\'"]', css, re.I):
                references.append((relative, match[1], True, False))
        elif path.suffix == '.webmanifest':
            manifest = json.loads(path.read_text(encoding='utf-8'))
            for icon in manifest.get('icons', []):
                references.append((relative, icon['src'], True, False))
    if Path('index.html') not in pages:
        raise ValueError('Output requires a home page')
    if require_sections is not None and not any(
        Path(name, 'index.html') in pages for name in require_sections
    ):
        raise ValueError('Publication requires at least one rendered organisation source section')
    for source, value, resource, allow_data in references:
        result = destination(root, origin, source, value, resource, allow_data)
        if result is None:
            continue
        target, fragment = result
        if fragment and target in pages and fragment not in pages[target].ids:
            raise ValueError(f'{source}: Missing fragment {fragment!r} in {target}')
    return sum(page.is_page for page in pages.values())


if __name__ == '__main__':
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument('directory', nargs='?', default='public')
    arguments.add_argument('--base-url', default='https://docs.unset.sh/')
    arguments.add_argument('--require-sections', help='JSON list of prepared organisation source names; publication only')
    arguments.add_argument('--brand-dir', help='Verified staged brand directory; compare the complete rendered _brand tree')
    options = arguments.parse_args()
    try:
        sections = section_names(json.loads(options.require_sections)) if options.require_sections is not None else None
        count = check_output(options.directory, options.base_url, require_sections=sections, brand_dir=options.brand_dir)
        print(f'Checked {count} HTML pages and their local assets')
    except (ValueError, OSError) as error:
        arguments.exit(1, f'{error}\n')
