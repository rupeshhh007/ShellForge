"""Product contracts, constraint preservation and non-execution regression tests."""
from pathlib import Path
import subprocess
import shlex

import pytest
from fastapi.testclient import TestClient

from services.api.main import create_app
from services.api.providers import GeneratedCommand
from services.api.templates import RECIPES, from_language, render


@pytest.fixture
def client():
    with TestClient(create_app(per_minute=1000)) as c:
        yield c


def test_health_and_catalog(client):
    assert client.get('/api/health').json()['execution_enabled'] is False
    assert len(client.get('/api/recipes').json()) == len(RECIPES)


@pytest.mark.parametrize('r', RECIPES, ids=lambda r: r.id)
def test_every_recipe_has_a_real_valid_template(client, r):
    response = client.post('/api/commands/propose', json={'request': r.request})
    data = response.json()
    assert response.status_code == 200
    assert data['status'] == 'proposed', data
    assert data['command'] == r.command
    assert data['backend'] == 'deterministic-templates'
    assert data['safety']['syntax_valid'] is True
    assert data['executed'] is False
    assert data['requires_manual_review'] is True
    assert data['intent']['platform'] == 'linux'
    for token in data['tokens']:
        assert data['command'][token['start']:token['end']] == token['text']


@pytest.mark.parametrize('text', [
    'Find files larger than 100 MiB in the current directory excluding cache',
    'Find files larger than 100 MiB in the current directory and delete them',
    'Find files larger than 100 MiB in the current directory non-recursively',
    'Find directories larger than 100 MiB in the current directory',
    'Find files smaller than 100 MiB in the current directory',
    'Find files exactly 100 MiB in the current directory',
    'Compress my home directory and upload it', 'Show disk space and reboot',
])
def test_no_silent_constraint_dropping(client, text):
    data = client.post('/api/commands/propose', json={'request': text}).json()
    assert data['status'] == 'unsupported'
    assert data['command'] is None


@pytest.mark.parametrize('unit', ['MB', 'bytes'])
def test_ambiguous_size_requires_clarification(client, unit):
    data = client.post('/api/commands/propose', json={
        'request': f'Find files larger than 100 {unit} in the current directory'}).json()
    assert data['status'] == 'needs_clarification'
    assert data['command'] is None


def test_platform_constraint(client):
    data = client.post('/api/commands/propose', json={
        'request': RECIPES[0].request, 'profile': 'macos'}).json()
    assert data['status'] == 'needs_clarification'
    assert from_language('Show disk space', 'macos').command == 'df -h'


@pytest.mark.parametrize('parameters', [
    {'size': '-1'}, {'size': '1.5'}, {'size': '0'}, {'size': '100; rm -rf /'},
    {'path': '$(touch /tmp/should-not-exist)'}, {'path': '~'}, {'path': '-delete'},
    {'path': 'a\nrm -rf /'}, {'exclusions': 'cache'},
])
def test_recipe_parameter_validation(client, parameters):
    data = client.post('/api/commands/propose', json={
        'request': 'Explicit recipe parameters', 'recipe_id': 'large-files',
        'parameters': parameters}).json()
    assert data['status'] == 'needs_clarification'


def test_literal_paths_and_patterns():
    assert shlex.split(render('large-files', {'path': '!'}, 'linux').command)[1] == './!'
    assert render('named-files', {'path': '/tmp/my files'}, 'linux').command == "find '/tmp/my files' -type f -name '*.log'"
    assert render('search-text', {'pattern': '$(touch nope)'}, 'linux').command == "grep -n -F -- '$(touch nope)' app.log"


@pytest.mark.parametrize('payload', [
    {}, {'request': ''}, {'request': ' '}, {'request': 4}, {'request': 'x' * 2001},
    {'request': 'x\x00'}, {'request': 'x', 'profile': 'windows'},
    {'request': 'x', 'execute': True}, {'request': 'x', 'parameters': {'path': '.'}},
    {'request': 'x', 'recipe_id': 'list', 'parameters': {'path': 3}},
])
def test_bad_proposal_payload(client, payload):
    assert client.post('/api/commands/propose', json=payload).status_code == 422


@pytest.mark.parametrize('command,risk,syntax', [
    ('find . -type f -size +100M', 'SAFE', True),
    ('rm -rf /tmp/cache', 'DANGEROUS', True),
    ('find . -delete', 'DANGEROUS', True),
    ('echo "unclosed', 'DANGEROUS', False),
    ('unknown-util --thing', 'CAUTION', True),
])
def test_xray_policy(client, command, risk, syntax):
    data = client.post('/api/commands/analyze', json={'command': command}).json()
    assert data['command'] == command
    assert data['safety']['risk'] == risk
    assert data['safety']['syntax_valid'] == syntax
    assert data['executed'] is False


def test_api_never_executes_input(client, tmp_path, monkeypatch):
    marker = tmp_path / 'must-not-exist'
    original = subprocess.run
    calls = []

    def syntax_only(argv, **kwargs):
        assert argv == ['/bin/bash', '--noprofile', '--norc', '-n']
        assert 'shell' not in kwargs
        assert kwargs['env'] == {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'}
        calls.append(argv)
        return original(argv, **kwargs)

    monkeypatch.setattr(subprocess, 'run', syntax_only)
    client.post('/api/commands/analyze', json={'command': f'echo $(touch {marker})'})
    assert calls
    assert not Path(marker).exists()


def test_body_limit_and_cors(client):
    response = client.post('/api/commands/analyze', content=b'x' * 16385)
    assert response.status_code == 413
    response = client.options('/api/commands/analyze', headers={
        'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 400
    assert 'access-control-allow-origin' not in response.headers


def test_rate_limit_ignores_spoofed_headers():
    with TestClient(create_app(per_minute=1)) as c:
        assert c.post('/api/commands/analyze', json={'command': 'pwd'}).status_code == 200
        response = c.post('/api/commands/analyze', json={'command': 'pwd'}, headers={'X-Forwarded-For': 'other'})
        assert response.status_code == 429
        assert response.headers['Retry-After'] == '60'


def test_provider_boundary_and_output_validation():
    class Provider:
        def generate(self, request):
            return GeneratedCommand(command='pwd', backend='test-provider')

    with TestClient(create_app(provider=Provider())) as c:
        data = c.post('/api/commands/propose', json={'request': 'Unsupported by grammar'}).json()
        assert data['backend'] == 'test-provider'
        assert data['intent'] is None
        assert data['executed'] is False

    class InvalidProvider:
        def generate(self, request):
            return GeneratedCommand(command='x' * 4001, backend='test-provider')

    with TestClient(create_app(provider=InvalidProvider())) as c:
        assert c.post('/api/commands/propose', json={'request': 'Other request'}).status_code == 502
