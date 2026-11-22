import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('check_output', Path(__file__).parents[1] / 'scripts/check-output.py')
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)

CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'"


def page(body='', head=''):
    return f'''<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="{CSP}">
    <meta name="robots" content="noindex, nofollow">{head}</head><body>{body}</body></html>'''


class OutputTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.put('index.html', page('<a href="/guide/#details">Guide</a><img src="/diagram.svg">',
            '<link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script>'))
        self.put('guide/index.html', page('<h1 id="details">Details</h1><a href="../">Home</a>'))
        self.put('site.css', '@font-face{font-family:Example;src:url("fonts/font.woff2")}')
        self.put('fonts/font.woff2', b'fixture font')
        self.put('site.js', 'document.documentElement.dataset.theme = "dark";')
        self.put('diagram.svg', '<svg xmlns="http://www.w3.org/2000/svg"><title>Flow</title></svg>')

    def put(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content if isinstance(content, bytes) else content.encode())

    def check(self):
        return checker.check_output(self.root)

    def test_validates_local_resources_fonts_and_deep_fragment_links(self):
        self.assertGreater(self.check(), 0)

    def test_allows_official_source_navigation_and_encoded_local_fragments(self):
        self.put('guide/index.html', page('<h1 id="details">Details</h1><h2 id="more info">More</h2>'
            '<a href="#more%20info">Local</a><a href="https://atproto.com/specs/atp">Protocol</a>'
            '<a href="https://docs.unset.sh/guide/#details">Canonical</a>'))
        self.check()

    def test_refuses_inline_execution_and_external_fetches(self):
        examples = [
            '<script>alert(1)</script>', '<script src="/site.js">alert(1)</script>',
            '<style>body{color:red}</style>', '<p style="color:red">text</p>',
            '<img src="/diagram.svg" onerror="alert(1)">',
            '<script src="https://cdn.example/script.js"></script>',
            '<img src="//cdn.example/image.png">',
            '<img srcset="/diagram.svg 1x, https://cdn.example/image.png 2x">',
            '<iframe src="https://example.com"></iframe>',
            '<a href="javascript:alert(1)">bad</a>',
            '<base href="https://example.com">',
            '<meta http-equiv="refresh" content="0;url=https://example.com">',
        ]
        for html in examples:
            with self.subTest(html=html):
                self.put('index.html', page(html))
                with self.assertRaises(ValueError):
                    self.check()

    def test_refuses_weakened_or_missing_page_policy(self):
        for policy in [page().replace("font-src 'self'; ", ''),
                       page().replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"),
                       page().replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
                       page().replace('noindex, nofollow', 'index, follow')]:
            with self.subTest(policy=policy):
                self.put('index.html', policy)
                with self.assertRaises(ValueError):
                    self.check()

    def test_refuses_broken_destinations_and_fragments(self):
        for href in ['/missing/', '/guide/#missing', '/guide/missing.md', '/%2e%2e/secret']:
            with self.subTest(href=href):
                self.put('index.html', page(f'<a href="{href}">Bad link</a>'))
                with self.assertRaises(ValueError):
                    self.check()

    def test_refuses_remote_css_assets_and_imports(self):
        for css in ['body{background:url(https://cdn.example/image.png)}',
                    '@import "https://cdn.example/style.css";',
                    '@font-face{src:url(data:font/woff2;base64,AAAA)}']:
            with self.subTest(css=css):
                self.put('site.css', css)
                with self.assertRaises(ValueError):
                    self.check()

    def test_refuses_missing_font_asset(self):
        (self.root / 'fonts/font.woff2').unlink()
        with self.assertRaisesRegex(ValueError, 'font.woff2'):
            self.check()

    def test_refuses_script_or_external_use_inside_svg(self):
        for svg in ['<svg><script>alert(1)</script></svg>',
                    '<svg><use href="https://cdn.example/icons.svg#mark"/></svg>']:
            with self.subTest(svg=svg):
                self.put('diagram.svg', svg)
                with self.assertRaises(ValueError):
                    self.check()

    def test_refuses_legacy_app_output(self):
        self.put('unset/index.html', page('Legacy app'))
        with self.assertRaisesRegex(ValueError, 'unset'):
            self.check()

    def test_refuses_output_links(self):
        (self.root / 'linked.css').symlink_to(self.root / 'site.css')
        with self.assertRaisesRegex(ValueError, 'link'):
            self.check()

    def test_refuses_duplicate_ids(self):
        self.put('guide/index.html', page('<h1 id="details">First</h1><h2 id="details">Second</h2>'))
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.check()

    def test_publication_requires_a_rendered_source_section(self):
        # Draft cascades and build.render: never can leave a valid exported
        # source tree without its landing page. A framework page is insufficient.
        with self.assertRaisesRegex(ValueError, 'rendered organisation source section'):
            checker.check_output(self.root, require_sections=['lexicons'])
        self.put('lexicons/topic/index.html', page('A child alone is not the section landing page.'))
        with self.assertRaisesRegex(ValueError, 'rendered organisation source section'):
            checker.check_output(self.root, require_sections=['lexicons'])

    def test_publication_allows_other_unrendered_source_sections(self):
        self.put('profile-recipes/index.html', page('Published recipes'))
        checker.check_output(self.root, require_sections=['lexicons', 'profile-recipes'])

    def test_publication_refuses_invalid_source_name_lists(self):
        for sections in [[], 'lexicons', {'lexicons': True}, ['../guide'], ['guide/index.html'], [None], ['Guide']]:
            with self.subTest(sections=sections), self.assertRaisesRegex(ValueError, 'section names'):
                checker.check_output(self.root, require_sections=sections)

    def test_cli_cannot_disable_publication_check_with_invalid_json(self):
        for argument in ['null', '[]', '"lexicons"', '{broken']:
            with self.subTest(argument=argument):
                result = subprocess.run([
                    sys.executable, SPEC.origin, str(self.root), '--require-sections', argument,
                ], capture_output=True, text=True)
                self.assertEqual(result.returncode, 1, result.stdout)

    def brand_fixture(self):
        staged = tempfile.TemporaryDirectory()
        self.addCleanup(staged.cleanup)
        brand_dir = Path(staged.name)
        assets = {'provenance.json': b'{"version":"0.1.1"}', 'fonts/body.woff2': b'brand font'}
        for name, content in assets.items():
            source = brand_dir / name
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(content)
            self.put('_brand/' + name, content)
        return brand_dir

    def test_accepts_exact_verified_brand_output(self):
        checker.check_output(self.root, brand_dir=self.brand_fixture())

    def test_refuses_content_replacing_brand_provenance_or_assets(self):
        brand_dir = self.brand_fixture()
        for name in ['provenance.json', 'fonts/body.woff2']:
            with self.subTest(name=name):
                self.put('_brand/' + name, b'replaced by source content')
                with self.assertRaisesRegex(ValueError, 'Brand output differs'):
                    checker.check_output(self.root, brand_dir=brand_dir)
                self.put('_brand/' + name, (brand_dir / name).read_bytes())

    def test_refuses_extra_or_missing_brand_files(self):
        brand_dir = self.brand_fixture()
        self.put('_brand/extra.json', '{}')
        with self.assertRaisesRegex(ValueError, 'Brand output file set'):
            checker.check_output(self.root, brand_dir=brand_dir)
        (self.root / '_brand/extra.json').unlink()
        (self.root / '_brand/provenance.json').unlink()
        with self.assertRaisesRegex(ValueError, 'Brand output file set'):
            checker.check_output(self.root, brand_dir=brand_dir)

    def test_refuses_links_in_the_staged_brand_tree(self):
        brand_dir = self.brand_fixture()
        (brand_dir / 'linked.json').symlink_to(brand_dir / 'provenance.json')
        with self.assertRaisesRegex(ValueError, 'Brand.*link'):
            checker.check_output(self.root, brand_dir=brand_dir)


if __name__ == '__main__':
    unittest.main()
