"""Verify generated discovery paths against the HTML the site actually publishes."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse


class Navigation(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = set()
        self.entries = set()
        self.ids = set()
        self.local_contents = []
        self.in_sidebar = False
        self.sidebar_links = set()
        self.sidebar_order = []
        self.in_heading = False
        self.project_entries = set()
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'aside':
            self.in_sidebar = True
        if tag == 'h2':
            self.in_heading = True
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('href'):
            href = unquote(urlsplit(attrs['href']).path)
            self.links.add(href)
            if self.in_sidebar:
                self.sidebar_links.add(href)
                self.sidebar_order.append(href)
            if 'data-docs-index-entry' in attrs:
                self.entries.add(href)
                if self.in_heading:
                    self.project_entries.add(href)
        if tag == 'details' and 'docs-local-contents' in attrs.get('class', '').split():
            self.local_contents.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'aside':
            self.in_sidebar = False
        if tag == 'h2':
            self.in_heading = False


def check_navigation(directory):
    root = Path(directory)
    pages = {path.relative_to(root).as_posix(): Navigation(path.read_text())
             for path in root.rglob('*.html') if path.name != '404.html'}
    catalog = pages.get('all-docs/index.html')
    if catalog is None:
        raise ValueError('Missing generated All documentation index')
    expected = set()
    for filename, page in pages.items():
        if '/all-docs/' not in page.links:
            raise ValueError(f'{filename}: no route to All documentation')
        if filename not in ('index.html', 'all-docs/index.html'):
            expected.add('/' + filename.removesuffix('index.html'))
    missing = expected - catalog.entries
    if missing:
        raise ValueError(f'Published pages missing from the index: {sorted(missing)}')
    home = pages.get('index.html')
    if not home or '/start-here/' not in home.links:
        raise ValueError('Homepage needs a Start here entry point')
    # These framework pages have headings and must expose their contents on mobile.
    # Other source pages may intentionally have no headings or set toc: false.
    for filename in ('organisation/index.html', 'start-here/index.html'):
        if not pages.get(filename) or not pages[filename].local_contents:
            raise ValueError(f'{filename}: missing independent page contents')
    for filename, page in pages.items():
        parts = Path(filename).parts
        if len(parts) > 2 and f'{parts[0]}/index.html' in pages:
            if f'/{parts[0]}/' not in page.sidebar_links:
                raise ValueError(f'{filename}: project Overview is missing from the sidebar')
    # One site-wide sidebar: Start here leads, and every project is reachable from every page.
    for filename, page in pages.items():
        if page.sidebar_order[:1] != ['/start-here/']:
            raise ValueError(f'{filename}: Start here must lead the sidebar')
        if missing := catalog.project_entries - page.sidebar_links:
            raise ValueError(f'{filename}: projects missing from the sidebar: {sorted(missing)}')
    print(f'Checked navigation for {len(pages)} HTML pages; {len(expected)} indexed documents')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    check_navigation(parser.parse_args().directory)
