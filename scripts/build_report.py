"""Generate a four-page A4 academic report from saved experiment evidence."""
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument("--experiment",type=Path)
report_args=parser.parse_args()
import json
import re
import textwrap
import html
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Image,PageBreak,KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont('SFRegular','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('SFBold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'reports';FIG=REPORTS/'figures';FIG.mkdir(parents=True,exist_ok=True)
load=lambda p:json.loads((ROOT/p).read_text())
stats=load('data/review2/stats.json');baseline=load('reports/metrics/generation.json');safety=load('reports/metrics/safety.json');compute=load('reports/compute.json')
base=load('reports/metrics/base/generation.json') if (REPORTS/'metrics/base/generation.json').exists() else None
tuned=load('reports/metrics/tuned/generation.json') if (REPORTS/'metrics/tuned/generation.json').exists() else None
manifest=load('artifacts/qwen-lora/training_manifest.json') if (ROOT/'artifacts/qwen-lora/training_manifest.json').exists() else None
if base and tuned:
    assert base['test_sha256']==tuned['test_sha256'] and base['n']==tuned['n']
new_comparison=None
new_manifest=None
quality_path=ROOT/'data/quality/audit.json'
if report_args.experiment:
    experiment=report_args.experiment
    quality_path=experiment/'quality/audit.json'
    completion=json.loads((experiment/'completion.json').read_text())
    if not completion.get('completed'):
        raise ValueError('Cannot report an incomplete experiment as measured results')
    selection=json.loads((experiment/'selection.json').read_text())
    new_comparison=json.loads((experiment/'comparison.json').read_text())
    new_manifest=json.loads((Path(selection['selected_adapter']).parent/'training_manifest.json').read_text())
    if not new_manifest.get('completed'):
        raise ValueError('Selected training did not complete')
BLUE='#2563eb' ;INK='#142238';MUTED='#526279';PALE='#eaf0f8'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'axes.spines.bottom':False,'axes.titleweight':'bold','axes.labelcolor':MUTED,'text.color':INK,'xtick.color':MUTED,'ytick.color':MUTED})

def savefig(name):
    plt.savefig(FIG/name,dpi=190,bbox_inches='tight',facecolor='white');plt.close()

fig,axes=plt.subplots(1,2,figsize=(9.2,2.7),gridspec_kw={'width_ratios':[1,1.8]})
risk=stats['heuristic_risk_counts'];labs=['SAFE','CAUTION','DANGEROUS'];vals=[risk.get(k,0) for k in labs]
axes[0].bar(labs,vals,color=['#2563eb','#9b6b16','#a43242']);axes[0].set_title('Heuristic risk labels');axes[0].tick_params(axis='x',labelsize=8)
for i,v in enumerate(vals):axes[0].text(i,v+100,f'{v:,}',ha='center',fontsize=9)
axes[0].set_ylim(0,max(vals)*1.25)
cats=sorted(stats['category_counts'].items(),key=lambda x:x[1]);axes[1].barh([k.replace('_',' ') for k,v in cats],[v for k,v in cats],color=BLUE);axes[1].set_title('Heuristic categories');axes[1].tick_params(axis='y',labelsize=8)
for i,(k,v) in enumerate(cats):axes[1].text(v+25,i,str(v),va='center',fontsize=8)
axes[1].set_xlim(0,max(v for _,v in cats)*1.18);fig.tight_layout();savefig('dataset.png')
fig,axes=plt.subplots(1,2,figsize=(9.2,2.9),gridspec_kw={'width_ratios':[1.1,1]})
cm=np.array(safety['confusion_matrix_rows_true_columns_pred']);axes[0].imshow(cm,cmap='Blues',vmin=0,vmax=max(cm.max(),1));axes[0].set_xticks(range(3),labs,fontsize=8);axes[0].set_yticks(range(3),labs,fontsize=8);axes[0].set_xlabel('Predicted');axes[0].set_ylabel('Authored true label');axes[0].set_title('Safety confusion matrix')
for i in range(3):
    for j in range(3):axes[0].text(j,i,str(cm[i,j]),ha='center',va='center',color='white' if cm[i,j]>cm.max()/2 else INK)
names=['Retrieval\n(full test)'];exact=[baseline['exact_match']*100];syntax=[baseline['bash_syntax_validity']*100]
for name,m in [('Qwen base\n(subset)',base),('Qwen LoRA\n(subset)',tuned)]:
    if m:names.append(name);exact.append(m['exact_match']*100);syntax.append(m['bash_syntax_validity']*100)
if new_comparison:
    for name,m in [('New base\n(unexposed)',new_comparison['primary_unexposed_test']['base']),('New LoRA\n(unexposed)',new_comparison['primary_unexposed_test']['tuned'])]:
        names.append(name);exact.append(m['exact_match_count']/new_comparison['primary_unexposed_test']['n']*100);syntax.append(m['bash_syntax_validity']*100)
x=np.arange(len(names));axes[1].bar(x-.18,exact,.36,label='Exact match',color=BLUE);axes[1].bar(x+.18,syntax,.36,label='Bash syntax',color='#97b6e9');axes[1].set_xticks(x,names,fontsize=8);axes[1].set_ylim(0,119);axes[1].set_title('Generation results (%)');axes[1].legend(frameon=False,fontsize=7,loc='upper center',ncol=2)
for i,(a,b) in enumerate(zip(exact,syntax)):
    axes[1].text(i-.18,a+2,f'{a:.1f}',ha='center',fontsize=8);axes[1].text(i+.18,b+2,f'{b:.1f}',ha='center',fontsize=8)
fig.tight_layout();savefig('metrics.png')
fig,ax=plt.subplots(figsize=(9.2,1.65));ax.set_xlim(0,10);ax.set_ylim(0,2);ax.axis('off')
from matplotlib.patches import FancyBboxPatch
for x,y,w,h,label in [(0,.85,1.5,.75,'NL request'),(2,.85,1.9,.75,'TF-IDF / Qwen\ncommand proposal'),(4.5,.85,2,.75,'bash -n + AST\nstatic safety policy'),(7.2,.85,2.5,.75,'Structured JSON\ncommand + risk + reason'),(4.5,0,2,.55,'Literal safe preview\nwhen verified')]:
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.05',facecolor=PALE,edgecolor='#c7d4e7'));ax.text(x+w/2,y+h/2,label,ha='center',va='center',fontsize=9)
for a,b in [((1.55,1.2),(1.95,1.2)),((3.95,1.2),(4.45,1.2)),((6.55,1.2),(7.15,1.2)),((5.5,.8),(5.5,.6))]:ax.annotate('',xy=b,xytext=a,arrowprops={'arrowstyle':'->','color':BLUE,'lw':1.5})
ax.text(.02,.12,'No command execution at any stage',fontsize=9,color='#a43242');savefig('architecture.png')

font_path='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
def excerpt(path,start_marker,line_count,name):
    lines=(ROOT/path).read_text().splitlines();start=next(i for i,l in enumerate(lines) if start_marker in l)
    selected=lines[start:start+line_count]
    wrapped=[]
    for idx,line in enumerate(selected,start+1):
        parts=textwrap.wrap(line,94,replace_whitespace=False,drop_whitespace=False) or ['']
        wrapped.extend([f'{idx:>3}  '+parts[0]]+['     '+p for p in parts[1:]])
    img=PILImage.new('RGB',(1600,100+len(wrapped)*29),'#eff3f8');draw=ImageDraw.Draw(img);font=ImageFont.truetype(font_path,20);title=ImageFont.truetype(font_path,22)
    draw.text((28,18),f'{path} | rendered source excerpt (not an app screenshot)',font=title,fill=INK)
    for i,line in enumerate(wrapped):draw.text((28,67+i*29),line,font=font,fill=INK)
    img.save(FIG/name)
if new_comparison:
    history=json.loads((Path(selection['selected_adapter']).parent/'history.json').read_text())
    fig,ax=plt.subplots(figsize=(9.2,2.0))
    for key,label in [('loss','Training (logged batches)'),('eval_loss','Validation (mean loss)')]:
        points=[(r.get('step',0),r[key]) for r in history if key in r]
        if points:ax.plot([p[0] for p in points],[p[1] for p in points],label=label)
    ax.set_xlabel('Optimizer step');ax.set_ylabel('Answer-token loss');ax.legend(frameon=False,fontsize=8)
    ax.set_title('Measured full-data optimization history');fig.tight_layout();savefig('loss_history.png')
excerpt('src/preprocess_dataset.py','def import_pairs',7,'code_preprocessing.png')
excerpt('src/inference.py','def propose',12,'code_inference.png')

def pct(x):return f'{100*x:.2f}%'
training_text=(f"Completed a small CPU LoRA pilot: {manifest['arguments']['max_steps']} optimizer steps, rank 8, alpha 16, q_proj/v_proj; 540,672 trainable parameters (0.1093%). Used {manifest['train_stats']['used']} of {manifest['train_stats']['selected']} selected training examples; {manifest['train_stats']['too_long']} exceeded the 192-token limit. Validation loss: {manifest['validation_metrics']['eval_loss']:.4f}. This is a feasibility run, not a fully trained production model." if manifest else 'LoRA implementation and Colab notebook are ready; fine-tuning is not completed in the saved evidence.')
generation_rows=[['Model / evaluation scope','n','Exact match','Bash syntax'],['TF-IDF 1-NN / full test',str(baseline['n']),pct(baseline['exact_match']),pct(baseline['bash_syntax_validity'])]]
for name,m in [('Qwen base / subset',base),('Qwen LoRA / same subset',tuned)]:
    if m:generation_rows.append([name,str(m['n']),pct(m['exact_match']),pct(m['bash_syntax_validity'])])
safety_rows=[['Safety class','Precision','Recall','F1','Support']]
for label in labs:
    r=safety['classification_report'][label];safety_rows.append([label,f"{r['precision']:.3f}",f"{r['recall']:.3f}",f"{r['f1-score']:.3f}",str(int(r['support']))])
examples=[]
if tuned:
    rows=[json.loads(l) for l in (REPORTS/'metrics/tuned/generation_examples.jsonl').read_text().splitlines()]
    for match in [True,False]:
        r=next((r for r in rows if r['exact_match']==match),None)
        if r:examples.append(r)
else:
    rows=[json.loads(l) for l in (REPORTS/'metrics/generation_examples.jsonl').read_text().splitlines()]
    examples=rows[:1]

testpath=REPORTS/'logs/full_data_tests.log'
if not testpath.exists():testpath=REPORTS/'logs/tests.log'
testlog=testpath.read_text();testsummary=next((l for l in reversed(testlog.splitlines()) if re.search(r'\d+ passed',l)),'See test logs; no passing summary found.')
missing=stats['missing_optional_fields_before_dedup']
comparison_text = (f' On the same {base["n"]} requests, Qwen base exact match was {pct(base["exact_match"])}, versus {pct(tuned["exact_match"])} for LoRA. The small fine-tuning run did not improve exact match; this subset is too small for a robust generalization claim.' if base and tuned else '')
quality_audit=json.loads(quality_path.read_text()) if quality_path.exists() else None
new_training_text=''
new_results_text=''
new_discussion=''
if new_comparison:
    m=new_manifest;p=new_comparison['primary_unexposed_test'];paired=p['paired']
    new_training_text=(f" New measured run: {m['train_stats']['used']:,} encoded training examples, {m['actual_optimizer_steps']} optimizer steps, {m['completed_epochs']:.3f} epochs; rank {m['arguments']['rank']}, attention/MLP LoRA, LR {m['arguments']['learning_rate']}, effective single-GPU batch {m['arguments']['batch_size']*m['arguments']['accumulation']}. Training loss {m['train_metrics']['train_loss']:.4f}; initial validation loss {m['initial_validation_metrics']['eval_loss']:.4f}; selected loss {m['validation_metrics']['eval_loss']:.4f}. Full validation selects trials; test is evaluated after selection.")
    new_results_text=(f" New primary test: {p['n']} cases unexposed to the old pilot. Base {p['base']['exact_match_count']}/{p['n']}; tuned {p['tuned']['exact_match_count']}/{p['n']}; delta {paired['exact_match_delta']*100:+.2f} percentage points, paired exact McNemar p={paired['mcnemar_exact_p']:.4f}. Wilson intervals, normalized match, AST support, syntax and heuristic categories are in comparison.json. AST overlap does not prove semantics. The full 1,254-case comparison includes 32 previously exposed pilot cases.")
    new_discussion=(' New validation exact match '+('improved' if selection['improved_validation_exact_match'] else 'did not improve')+'; unexposed test exact match '+('increased' if paired['exact_match_delta']>0 else 'did not increase')+'. No predetermined improvement or semantic-equivalence claim is made.')
sections={
'Dataset':f"The original NL2Bash corpus has 12,607 natural-language lines and 12,607 command lines. The repository also has 20 curated records, a 100-row import, 120-row pilot and old 96/12/12 splits. All original data and Review 1 documentation were preserved. Review 2 ingested {stats['input_records']:,} occurrences across the corpus and original JSONL files. Count equality and source SHA-256 hashes establish positional consistency, not universal semantic alignment. Original risk annotations remain unverified; independently verified corpus risk labels: 0.",
'Dataset Preprocessing':f"Typed JSON validation rejects malformed objects, missing/non-string/empty required fields and NULs. Command bytes, case, quotes and internal spacing are preserved. Syntax checks use Bash parse-only mode with a clean environment. Removed {stats['discard_counts'].get('duplicate_pair',0)} duplicate occurrences and {stats['discard_counts'].get('invalid_bash_syntax',0)} syntax-invalid occurrences; retained {stats['retained']:,}. Connected components isolate shared normalized instructions, AST literal quote/spacing equivalents and known additive ls/rm flag variants. Seed 42 yields {stats['equivalence_groups']:,} groups (largest {stats['largest_group']}); splits {stats['splits']['train']:,}/{stats['splits']['validation']:,}/{stats['splits']['test']:,}. All checked cross-split overlaps are zero. Arbitrary semantic paraphrase leakage is not ruled out. Missing optional fields before dedup: category {missing.get('category',0):,}, risk {missing.get('risk',0):,}, explanation {missing.get('explanation',0):,}, safe alternative {missing.get('safe_alternative',0):,}; retained as missing/provenance rather than fabricated annotations.",
'Code Implementation':"A training-only character TF-IDF retrieval baseline and optional Qwen Transformers generator feed the same static validator and structured JSON CLI. The validator handles deletion flag variants, find actions, file truncation, formatting, privilege changes, broad permissions, termination, wrappers, interpreters, substitutions and dangerous pipelines. Unknown utilities require review; unsupported shell constructs fail closed. A preview is emitted only for simple literal recursive rm and is revalidated as read-only. Other cases explicitly return no verified preview. Every response records executed=false and requires manual review. "+training_text,
'Metrics - Results and Discussion':f"Generation is evaluated on held-out requests using strict command-byte exact match and Bash -n syntax validity. The retrieval baseline has {pct(baseline['exact_match'])} exact match on {baseline['n']} cases; command grouping intentionally prevents memorized command overlap. Its {pct(baseline['bash_syntax_validity'])} syntax validity reflects copying valid training commands, not task correctness. Qwen base/LoRA comparisons, when present, use the same deterministic {base['n'] if base else 0}-record held-out subset, not the full test. Safety uses {safety['n']} separately authored cases with operation-based labels, never validator-generated truth. Final macro F1 is {safety['classification_report']['macro avg']['f1-score']:.4f}; dangerous false negatives: {len(safety['dangerous_false_negatives'])}. This benchmark was used to refine the policy and is not an untouched generalization set. Labels are assistant-authored, not external expert consensus. No command execution or semantic correctness percentage is claimed." + comparison_text,
'What Went Wrong':"The original importer could silently truncate unequal files; old random splits leaked shared commands/instructions. Retrieval produced zero held-out exact matches, showing its inability to synthesize unseen commands. The initial safety benchmark missed date -s and chmod ugo=rwx (two dangerous false negatives); both were fixed while preserving initial scores. Two harmless compound examples remain rejected by the conservative policy. Direct git clone failed authentication; connector access recovered the repository. Initial model-client dependencies were incompatible with the available proxy; pinned compatible versions resolved access. An initial training run was interrupted to finalize stronger split equivalence, then restarted on final artifacts. The 20-step CPU pilot uses very little data and cannot establish robust model quality. LoRA exact match decreased from 3/32 to 2/32; a completed training run is not proof of improvement.",
 'Alternative Flow / Proposed Improvements':"Prepared cloud protocol: restore split hashes; audit training only; up to 3 epochs, rank 16 attention/MLP LoRA, batch 16, 512 tokens, seed 42, LR trials 1e-4/5e-5, cosine decay and 5% warmup. Save/evaluate every 100 steps, patience 3. Select by full-validation exact match, then loss; freeze before paired test. No GPU completion is claimed until manifests exist. Primary test: 1,222 cases unexposed to the old pilot; full 1,254 results disclose 32 exposed cases. Future work: adjudicate semantic alignment and safety labels, review command equivalence, compare each larger model against its own base, and calibrate abstention. AST similarity never proves semantics. Keep execution disabled."
}
if quality_audit:
    sections['Dataset Preprocessing'] = sections['Dataset Preprocessing'].split(' Missing optional fields')[0]
    sections['Dataset Preprocessing'] += (f" Follow-up training-only audit retained {quality_audit['retained']:,}/{quality_audit['input_records']:,} examples; additional exclusions {quality_audit['removed']}. A 100-pair assistant static review identified ten wrong paths, time predicates, unsupported tasks or unintended actions; labels are not externally adjudicated. Original split membership and held-out bytes remain unchanged.")
if new_comparison:
    sections['Code Implementation'] += new_training_text
    sections['Metrics - Results and Discussion'] = ('Original results are retained in the table below. '+new_results_text)
    sections['What Went Wrong'] += new_discussion
    sections['Alternative Flow / Proposed Improvements'] = ('The completed run uses validation-selected checkpoints and trial settings. Remaining work: human semantic adjudication, a fresh external safety benchmark, model-capacity comparisons against each model own base, and calibrated abstention. Keep generated execution disabled. Logs, loss history, hashes and the selected adapter are retained in the cloud experiment folder.')
    p=new_comparison['primary_unexposed_test']
    for name,m in [('New base / unexposed',p['base']),('New LoRA / unexposed',p['tuned'])]:
        generation_rows.append([name,str(p['n']),pct(m['exact_match_count']/p['n']),pct(m['bash_syntax_validity'])])
else:
    sections['What Went Wrong'] += ' No full-data GPU training has been executed in the prepared continuation; no new accuracy or loss is claimed.'
md=['# ShellForge - Review 2','', 'Measured original cloud pilot; full-data GPU continuation status is stated explicitly. Source snapshot: ad24e3dc045fadacca75f796b99107b7072a60a6. Branch: codex/review2-cloud.','']
for idx,(heading,body) in enumerate(sections.items(),1):
    md += [f'## {idx}. {heading}','',body,'']
    if heading=='Dataset Preprocessing':md += ['![Dataset distributions](figures/dataset.png)','']
    if heading=='Code Implementation':md += ['![Architecture](figures/architecture.png)','![Actual source excerpt](figures/code_inference.png)','']
    if heading=='Metrics - Results and Discussion':
        for rows in [generation_rows,safety_rows]:
            md += ['| '+' | '.join(rows[0])+' |','| '+' | '.join(['---']*len(rows[0]))+' |']+['| '+' | '.join(row)+' |' for row in rows[1:]]+['']
        md += ['![Actual metrics](figures/metrics.png)','']
        for r in examples:md += [f"Example ({'exact-match success' if r['exact_match'] else 'exact-match failure'}): {r['instruction']}",f"Reference: `{r['reference']}`",f"Prediction: `{r['prediction']}`",'']
md+=['## Verification and reproduction','',testsummary,'','See README.md for exact cloud commands. See reports/logs/commands.txt, data/review2/stats.json, reports/metrics/ and artifacts/qwen-lora/training_manifest.json for detailed evidence.','', 'References: NL2Bash, Lin et al. (2018), https://github.com/TellinaTool/nl2bash; Qwen2.5-0.5B-Instruct model card, https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct; LoRA, Hu et al. (2021), https://arxiv.org/abs/2106.09685. Model revision: 7ae557604adf67be50417f59c2c2f167def9a775.']
(REPORTS/'ShellForge_Review2.md').write_text('\n'.join(md)+'\n')
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='BodySF',fontName='SFRegular',fontSize=9.3,leading=13,textColor=colors.HexColor(INK),spaceAfter=7));styles.add(ParagraphStyle(name='SmallSF',fontName='SFRegular',fontSize=8,leading=10.5,textColor=colors.HexColor(MUTED),spaceAfter=5));styles.add(ParagraphStyle(name='HeadingSF',fontName='SFBold',fontSize=14,leading=18,textColor=colors.HexColor(INK),spaceBefore=9,spaceAfter=8));styles.add(ParagraphStyle(name='TitleSF',fontName='SFBold',fontSize=30,leading=34,textColor=colors.HexColor(INK),spaceAfter=5))
P=lambda text,style='BodySF':Paragraph(html.escape(text),styles[style])
story=[]
def h(t):story.append(P(t,'HeadingSF'))
def b(t):story.append(P(t))
def image(name,width=505):
    im=PILImage.open(FIG/name);story.append(Image(str(FIG/name),width=width,height=width*im.height/im.width));story.append(Spacer(1,5))
def table(rows,widths):
    t=Table([[P(str(v),'SmallSF') for v in row] for row in rows],colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(PALE)),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#c7d4e7')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#e3e9f0')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),5)]));story.append(t);story.append(Spacer(1,7))

story.append(P('SHELLFORGE','TitleSF'));b('Review 2 | Safe natural-language Bash command proposals')
story.append(P('CLOUD CPU EXPERIMENT  /  09 OCT 2026  /  NO COMMAND EXECUTION','SmallSF'))
h('1. Dataset');b(sections['Dataset'])
table([['Aligned corpus','Retained records','Train / Val / Test'],['12,607 pairs',f"{stats['retained']:,}",f"{stats['splits']['train']:,} / {stats['splits']['validation']:,} / {stats['splits']['test']:,}"]],[150,150,205])
h('2. Dataset Preprocessing');b(sections['Dataset Preprocessing']);image('dataset.png')
story.append(P('All distribution labels shown above are heuristic. Originals and old splits remain intact; full lineage and discard reasons are saved separately.','SmallSF'))
story.append(PageBreak())
h('3. Code Implementation');image('architecture.png');b(sections['Code Implementation']);image('loss_history.png' if new_comparison else 'code_preprocessing.png');image('code_inference.png')
story.append(P('Evidence: real excerpts rendered from committed source, not application screenshots. CLI emits command, safety reasons, syntax validity, explanation, optional preview, backend and executed=false.','SmallSF'))
story.append(PageBreak())
h('4. Metrics - Results and Discussion');b(sections['Metrics - Results and Discussion']);table(generation_rows,[230,45,115,115]);table(safety_rows,[145,90,90,90,90]);image('metrics.png')
for r in examples:
    label='Exact-match success' if r['exact_match'] else 'Exact-match failure'
    story.append(P(label+': '+r['instruction'][:165],'SmallSF'))
    story.append(P('Reference: '+r['reference'][:170]+' | Proposed: '+r['prediction'][:170],'SmallSF'))
story.append(PageBreak())
h('5. What Went Wrong');b(sections['What Went Wrong'])
h('6. Alternative Flow / Proposed Improvements');b(sections['Alternative Flow / Proposed Improvements'])
h('Verification and reproducibility');b(testsummary)
b('Original pilot: Linux x86_64, 9 CPUs, no CUDA. Full-data continuation runs in Colab; see selection.json and training_manifest.json for completion evidence. See README.md and notebooks/ShellForge_Colab.ipynb for exact commands. The 32 old test cases are disclosed separately from 1,222 unexposed cases.')
table([['Evidence','Repository path'],['Source/data audit and counts','docs/review2_audit.md; data/review2/stats.json'],['Actual generation + safety predictions','reports/metrics/; reports/logs/'],['LoRA completion and model artifact','artifacts/qwen-lora/training_manifest.json'],['GPU continuation (future larger run)','notebooks/ShellForge_Colab.ipynb']],[210,295])
story.append(P('References: Lin et al., NL2Bash (2018), github.com/TellinaTool/nl2bash; Hu et al., LoRA (2021), arxiv.org/abs/2106.09685; Qwen2.5 model card, huggingface.co/Qwen/Qwen2.5-0.5B-Instruct. Corpus file alignment is positional evidence only; no renewed claim of independently verified labels.','SmallSF'))

def footer(c,doc):
    c.setStrokeColor(colors.HexColor('#d7e1ee'));c.line(45,40,A4[0]-45,40);c.setFont('SFRegular',8);c.setFillColor(colors.HexColor(MUTED));c.drawString(45,27,'SHELLFORGE  /  REVIEW 2  /  MEASURED EVIDENCE');c.drawRightString(A4[0]-45,27,f'{doc.page} / 4')
SimpleDocTemplate(str(REPORTS/'ShellForge_Review2.pdf'),pagesize=A4,rightMargin=45,leftMargin=45,topMargin=40,bottomMargin=52).build(story,onFirstPage=footer,onLaterPages=footer)
print('Report and figures generated from actual saved evidence.')
