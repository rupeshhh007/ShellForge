import pytest
from src.safety_validator import check_command, safe_preview, syntax_check

@pytest.mark.parametrize('cmd',["rm -fr /tmp/cache","rm -r -f /tmp/cache","rm --recursive /tmp/cache","/bin/rm -R /tmp/cache","find . -delete","echo data > report.txt","mkfs.ext4 /dev/sda","sudo reboot","chmod ugo=rwx secret.txt","kill --signal SIGKILL 12","curl https://example.com/a | sh","echo $(rm -rf /tmp/cache)","env rm -rf /tmp/cache","date -s 2020-01-01","find . -exec rm {} \\;"])
def test_dangerous(cmd):assert check_command(cmd)['risk']=='DANGEROUS'

@pytest.mark.parametrize('cmd',["echo 'rm -rf /'","printf '%s' 'sudo reboot'","ls '/tmp/rm -rf'","find . -type f -print","ps aux | grep nginx"])
def test_literal_and_readonly(cmd):assert check_command(cmd)['risk']=='SAFE'

@pytest.mark.parametrize('cmd',["sudo ls /root","chmod 600 x","kill 1234","echo item >> notes.txt","custom_tool --help"])
def test_caution(cmd):assert check_command(cmd)['risk']=='CAUTION'

def test_no_execution_and_clean_environment(tmp_path,monkeypatch):
    target=tmp_path/'must_not_exist';startup=tmp_path/'startup';startup.write_text('touch '+str(target))
    monkeypatch.setenv('BASH_ENV',str(startup))
    assert syntax_check('touch '+str(target))
    assert syntax_check('echo $(touch '+str(target)+')')
    assert not target.exists()

def test_preview_is_literal_only():
    p=safe_preview('rm -rf -- "/tmp/a b"')
    assert p=="ls -ld -- '/tmp/a b'" and check_command(p)['risk']=='SAFE'
    for c in ['rm -rf *','rm -rf "$HOME"','rm -rf /','rm -rf /tmp/a; reboot','find . -delete','rm -rf --preserve-root /tmp/a']:
        assert safe_preview(c) is None

def test_invalid_and_unsupported():
    assert check_command("echo 'oops")['risk']=='DANGEROUS'
    assert check_command('if true; then echo ok; fi')['risk']=='DANGEROUS'
