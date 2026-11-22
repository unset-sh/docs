"""Exercise generated navigation using the explicit preview content."""
from html.parser import HTMLParser
from pathlib import Path
import sys


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.index = set()
        self.contents = set()
        self.sidebar = set()
        self.in_sidebar = False
        self.contents_depth = 0
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'aside':
            self.in_sidebar = True
        if tag == 'ul' and (self.contents_depth or 'docs-contents-list' in attrs.get('class', '').split()):
            self.contents_depth += 1
        if tag == 'a':
            href = attrs.get('href')
            if 'data-docs-index-entry' in attrs:
                self.index.add(href)
            if self.contents_depth:
                self.contents.add(href)
            if self.in_sidebar:
                self.sidebar.add(href)

    def handle_endtag(self, tag):
        if tag == 'aside':
            self.in_sidebar = False
        if tag == 'ul' and self.contents_depth:
            self.contents_depth -= 1


root = Path(sys.argv[1])
index = Links((root / 'all-docs/index.html').read_text())
expected = {'/example-project/', '/example-project/advanced/',
            '/example-project/advanced/notes/', '/example-project/schemas/'}
assert expected <= index.index, f'Missing nested, unclassified or reference pages: {expected - index.index}'
for slug in ('unpublished', 'headless', 'link-only', 'link-only-section', 'link-only-section/child'):
    assert f'/example-project/{slug}/' not in index.index
    assert not (root / f'example-project/{slug}/index.html').exists()
notes = Links((root / 'example-project/advanced/notes/index.html').read_text())
assert '#a-heading-without-a-preceding-level-two' in notes.contents, 'Skipped heading level lost its contents link'
assert expected - {'/example-project/schemas/'} <= notes.sidebar, 'Nested navigation or project Overview was lost'
print('Checked nested pages, unknown kinds, reference pages, unpublished content and skipped heading levels')
