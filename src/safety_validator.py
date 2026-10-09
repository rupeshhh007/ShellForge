"""Conservative, static Bash AST policy. SAFE means allowlisted, not guaranteed safe."""
import argparse
import json
import os
import re
import subprocess
import bashlex

READ_ONLY = {'ls','pwd','find','grep','egrep','fgrep','head','tail','cat','wc','sort','uniq','cut','tr','echo','printf','ps','pgrep','df','du','free','uptime','whoami','id','uname','date','stat','file','readlink','basename','dirname','which','whereis','true','false','test','[','seq','sleep','less','more','tee'}
MUTATING = {'cp','mv','mkdir','touch','rmdir','chmod','chown','chgrp','kill','pkill','killall','sudo','su','doas','mount','umount','tar','zip','unzip','gzip','gunzip','curl','wget','ssh','scp','rsync','apt','apt-get','yum','dnf','pip','npm','systemctl','service','crontab','truncate','install'}
DANGEROUS = {'mkfs','mke2fs','fdisk','parted','wipefs','shred','shutdown','reboot','poweroff','halt','dd','eval','exec','source','.'}

def syntax_check(command):
    if not isinstance(command, str) or not command.strip() or '\x00' in command:
        return False
    try:
        # -n reads syntax only; clean env prevents BASH_ENV startup sourcing.
        result = subprocess.run(['/bin/bash','--noprofile','--norc','-n'], input=command,
                                text=True, capture_output=True, timeout=3,
                                env={'PATH':'/usr/bin:/bin','LC_ALL':'C'})
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False

def walk(node):
    yield node
    for value in vars(node).values():
        if isinstance(value, bashlex.ast.node):
            yield from walk(value)
        elif isinstance(value, list):
            for child in value:
                if isinstance(child, bashlex.ast.node):
                    yield from walk(child)

def parse_nodes(command):
    return [n for root in bashlex.parse(command) for n in walk(root)]

def check_command(command):
    reasons = []
    severity = 0
    def flag(level, reason):
        nonlocal severity
        severity = max(severity, level)
        if reason not in reasons:
            reasons.append(reason)
    valid = syntax_check(command)
    if not valid:
        return {'risk':'DANGEROUS','reasons':['Invalid or empty Bash syntax'], 'syntax_valid':False,'policy':'static-v2'}
    try:
        nodes = parse_nodes(command)
    except Exception as exc:
        return {'risk':'DANGEROUS','reasons':['Unsupported Bash AST: '+type(exc).__name__], 'syntax_valid':True,'policy':'static-v2'}
    for n in nodes:
        if n.kind in {'commandsubstitution','processsubstitution'}:
            flag(2, 'Dynamic command/process substitution requires rejection')
        if n.kind in {'function','compound','for','while','until','if'}:
            flag(2, 'Compound shell control flow requires rejection')
        if n.kind == 'redirect' and n.type not in {'<','<&'}:
            target = getattr(n.output, 'word', str(n.output))
            if isinstance(n.output, int):
                continue  # descriptor duplication is not a file write
            if target == '/dev/null':
                continue
            flag(2 if n.type in {'>','>|','<>'} or target.startswith(('/dev/','/etc/','/proc/','/sys/')) else 1,
                 'Destructive truncation/redirection' if n.type in {'>','>|','<>'} else 'Output redirection writes a file')
        if n.kind != 'command':
            continue
        words = [p.word for p in n.parts if p.kind == 'word']
        if not words:
            flag(1, 'Assignment-only command changes shell state')
            continue
        name = os.path.basename(words[0])
        args = words[1:]
        if any(p.kind == 'assignment' for p in n.parts):
            flag(1, 'Environment assignment can alter utility behavior')
        if '$' in words[0] or any(c in words[0] for c in '*?'):
            flag(2, 'Dynamic executable name')
        if name in {'env','command','builtin','xargs','nohup','timeout','nice','busybox'}:
            flag(2, 'Execution wrapper requires rejection; nested behavior is not proven safe')
        elif name in {'bash','sh','zsh','dash','python','python3','perl','ruby','node'}:
            flag(2, 'Interpreter execution can contain arbitrary side effects')
        elif name in {'sudo','doas'}:
            flag(1, 'Elevated privileges')
            # Inspect the literal delegated command; never execute the wrapper.
            skip_value = {'-u','-g','-h','-p','-C','-T','-R','-D','-U','--user','--group','--host','--prompt','--chdir','--chroot'}
            index = 0
            while index < len(args):
                arg = args[index]
                if arg == '--':
                    index += 1
                    break
                if arg in skip_value:
                    index += 2
                elif arg.startswith('-'):
                    index += 1
                else:
                    break
            if index < len(args):
                import shlex
                nested = check_command(' '.join(shlex.quote(a) for a in args[index:]))
                for reason in nested['reasons']:
                    flag(2 if nested['risk'] == 'DANGEROUS' else 1, 'Delegated command: ' + reason)
        elif name == 'su':
            flag(2, 'Privileged shell can execute arbitrary commands')
        elif name in DANGEROUS or name.startswith('mkfs.'):
            flag(2, 'Formatting, raw writes, shutdown or arbitrary shell execution')
        elif name == 'rm':
            flags = [a for a in args if a.startswith('-')]
            recursive = any(a in {'--recursive'} or (a.startswith('-') and not a.startswith('--') and 'r' in a.lower()) for a in flags)
            flag(2 if recursive else 1, 'Recursive deletion' if recursive else 'File deletion')
        elif name == 'find':
            if '-delete' in args:
                flag(2, 'find -delete removes matching files')
            if any(a in args for a in {'-exec','-execdir','-ok','-okdir','-fprint','-fprintf','-fls'}):
                flag(2, 'find action executes or writes')
        elif name in {'kill','pkill','killall'}:
            force = any(a in {'-9','-KILL','-SIGKILL','KILL','SIGKILL','9','--signal=9','--signal=KILL'} for a in args)
            flag(2 if force else 1, 'Forced process termination' if force else 'Process termination')
        elif name in {'chmod','chown','chgrp'}:
            broad = any(a in {'777','0777','a+rwx','ugo+rwx','ugo=rwx','a=rwx','o+w','o=w','-R','--recursive'} for a in args)
            flag(2 if broad else 1, 'Broad/recursive permission or ownership change' if broad else 'Permission/ownership change')
        elif name in {'sed','awk','gawk','mawk'}:
            # Embedded languages may execute/write; do not treat text as inert data.
            flag(2, 'Embedded language program requires independent review')
        elif name == 'tee':
            flag(2 if '-a' not in args and '--append' not in args else 1, 'tee writes/truncates files')
        elif name == 'date' and any(a in {'-s','--set'} or a.startswith('--set=') for a in args):
            flag(2, 'System clock modification')
        elif name in MUTATING:
            flag(1, 'Privileges, mutation or network side effects: '+name)
        elif name not in READ_ONLY:
            flag(1, 'Unknown utility requires manual review: '+name)
        if name in {'sort','uniq'} and any(a == '-o' or a.startswith('--output') for a in args):
            flag(2, 'Utility output option overwrites a file')
        if name == 'grep' and any(a in {'-P','--perl-regexp'} for a in args):
            flag(1, 'Complex regular expression requires review')
        if name in {'cat','head','tail','less','more','grep'} and any(a.startswith(('/etc/shadow','/root/','.ssh/','/proc/')) for a in args):
            flag(1, 'Sensitive file access')
    return {'risk':('SAFE','CAUTION','DANGEROUS')[severity], 'reasons':reasons,
            'syntax_valid':valid,'policy':'static-v2'}

def safe_preview(command):
    """Return a reviewed read-only preview only for simple literal recursive rm."""
    try:
        roots = bashlex.parse(command)
        if len(roots) != 1 or roots[0].kind != 'command':
            return None
        n = roots[0]
        if any(p.kind != 'word' or p.parts for p in n.parts):
            return None
        words = [p.word for p in n.parts]
        if words[0] != 'rm' or not any(a == '--recursive' or re.fullmatch(r'-[rfRF]+',a) and 'r' in a.lower() for a in words[1:]):
            return None
        targets = []
        options = True
        for arg in words[1:]:
            if options and arg == '--':
                options = False
                continue
            if options and arg.startswith('-'):
                if arg != '--recursive' and not re.fullmatch(r'-[rfRF]+',arg):
                    return None
                continue
            if not arg or any(c in arg for c in '*?[]{}~$') or arg in {'/','.','..'}:
                return None
            targets.append(arg)
        if not targets:
            return None
        import shlex
        preview = 'ls -ld -- ' + ' '.join(shlex.quote(t) for t in targets)
        return preview if check_command(preview)['risk'] == 'SAFE' else None
    except Exception:
        return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command')
    print(json.dumps(check_command(parser.parse_args().command), indent=2))
