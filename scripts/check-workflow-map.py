"""Check rendered workflow calls against the exact catalogue used for the build."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path


def normalise(text):
    return ' '.join(text.split())


class WorkflowCalls(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.calls = []
        self.current = None
        self.link = None
        self.li_depth = 0
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'li':
            if self.current is not None:
                self.li_depth += 1
            elif 'workflow-map-call' in attrs.get('class', '').split():
                self.current = []
                self.li_depth = 1
        if tag == 'a' and self.current is not None:
            self.link = {'href': attrs.get('href'), 'text': ''}

    def handle_data(self, text):
        if self.link is not None:
            self.link['text'] += text

    def handle_endtag(self, tag):
        if tag == 'a' and self.link is not None:
            self.current.append((self.link['href'], normalise(self.link['text'])))
            self.link = None
        if tag == 'li' and self.current is not None:
            self.li_depth -= 1
            if self.li_depth == 0:
                self.calls.append(self.current)
                self.current = None


def check_workflow_map(directory, catalogue_path):
    catalogue = json.loads(Path(catalogue_path).read_text())
    workflows = {workflow['id']: workflow for workflow in catalogue['workflows']}
    page = Path(directory) / 'workflows/index.html'
    rendered = WorkflowCalls(page.read_text()).calls
    expected = []
    for call in catalogue['calls']:
        identities = [call['callerId']]
        if call['status'] == 'resolved':
            identities.append(call['targetId'])
        expected.append([
            ('#workflow-' + hashlib.sha256(identity.encode()).hexdigest(),
             normalise(workflows[identity]['name']))
            for identity in identities
        ])
    if rendered != expected:
        raise ValueError('Rendered workflow calls do not match their catalogue identities and labels')
    print(f'Checked {len(expected)} rendered workflow calls against their source catalogue')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('catalogue')
    args = parser.parse_args()
    try:
        check_workflow_map(args.directory, args.catalogue)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'{error}\n')
