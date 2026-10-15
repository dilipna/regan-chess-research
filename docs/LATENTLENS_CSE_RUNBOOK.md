# LatentLens on the CSE GPU machines (turing, cerf, or similar)

Step-by-step commands for running the Qwen3-8B experiments on a university GPU machine and bringing the results back to
the website. Nothing here assumes a particular scheduler: section 2 shows how to check, and both the interactive and
the Slurm variants are given.

## 0. What needs a GPU and what does not

| Task | Needs | Status |
|---|---|---|
| Architecture inspection, tokenizer examples | CPU only | done locally |
| One-sentence trace, recall analysis | any CUDA GPU (layer streaming works on 4 GB) | done locally (bf16 and fp32) |
| Hidden-state extraction on EditLens (thousands of documents) | a GPU with at least 24 GB for `--loader full` in bf16 (8B weights are 16.4 GB); smaller GPUs can use `--loader stream`, slower | **pending** (dataset access) |
| Probes, RMSNorm and component studies, PCA | CPU (scikit-learn) | pending (needs extraction) |

## 1. Get the code

```bash
git clone https://github.com/dilipna/regan-chess-research.git
cd regan-chess-research
git checkout latentlens-v2
```

## 2. Check the machine

```bash
hostname; nvidia-smi                       # GPU model and free memory
python3 --version                          # 3.11 or newer
df -h $HOME /tmp                           # where there is space for ~20 GB of model files
which sbatch squeue 2>/dev/null && echo "Slurm present" || echo "no Slurm: run interactively"
quota -s 2>/dev/null                       # home quota, if enforced
```

If the machine is shared, check who is using the GPU (`nvidia-smi`) before starting a long job.

## 3. Python environment

```bash
python3 -m venv ~/venvs/latentlens
source ~/venvs/latentlens/bin/activate
pip install --upgrade pip
# pick the CUDA build that matches `nvidia-smi` (driver CUDA version >= wheel CUDA version)
pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cu126
pip install -r scripts/latentlens/requirements.txt
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

## 4. Hugging Face cache and access

Put the cache where there is space (the home directory is often small):

```bash
export HF_HOME=/path/with/space/hf_cache          # add to ~/.bashrc
mkdir -p "$HF_HOME"
hf auth login                                     # paste a read token from huggingface.co/settings/tokens
```

The dataset is gated. Once, in a browser, open https://huggingface.co/datasets/pangram/editlens_iclr, fill in the form
(name, institution, intended non-commercial research use) and wait for approval. Then check:

```bash
python -c "from huggingface_hub import hf_hub_download as d; print(d('pangram/editlens_iclr','data/val-00000-of-00001.parquet',repo_type='dataset'))"
```

## 5. Download the model (once, about 16 GB)

```bash
hf download Qwen/Qwen3-8B-Base --revision 49e3418fbbbca6ecbdf9608b4d22e5a407081db4
hf download Qwen/Qwen3-0.6B-Base --revision da87bfb608c14b7cf20ba1ce41287e8de496c0cd   # for the tests
```

## 6. Sanity checks (minutes)

```bash
python -m pytest -q tests/latentlens                                         # streaming == full model, hooks, pipeline
python scripts/latentlens/inspect_qwen_architecture.py --model Qwen/Qwen3-8B-Base   # must print "13/13 verified"
python scripts/latentlens/trace_one_token.py --loader full --device cuda      # compare with the committed token_trace.json
```

## 7. Human-vs-AI extraction

Representations go to `data/latentlens/reps/qwen3-8b-editlens_iclr/` (gitignored; several GB). The command is
resumable: rerun it after an interruption and it continues after the last finished chunk.

```bash
R=data/latentlens/reps/qwen3-8b-editlens_iclr
for SPLIT_N in train:4000 val:1000 test:2000 test_llama:1000 test_enron:1000; do
  python scripts/latentlens/extract_hidden_states.py --model Qwen/Qwen3-8B-Base \
    --dataset hf:pangram/editlens_iclr --split ${SPLIT_N%%:*} --limit ${SPLIT_N##*:} \
    --loader full --device cuda --dtype bfloat16 --batch-size 8 --max-tokens 512
done
```

Before the full run, check the label mapping: the first lines printed include the `text_type` values found. The task
uses only human-written vs fully AI-generated text (`--human-types`, `--ai-types` set the mapping; anything else, such
as AI-edited text, is excluded and counted).

Slurm variant (only if `sbatch` exists; adjust partition and account names to the machine):

```bash
cat > extract.sbatch <<'EOF'
#!/bin/bash
#SBATCH --job-name=latentlens
#SBATCH --gres=gpu:1
#SBATCH --mem=48G
#SBATCH --time=08:00:00
source ~/venvs/latentlens/bin/activate
export HF_HOME=/path/with/space/hf_cache
cd ~/regan-chess-research
python scripts/latentlens/extract_hidden_states.py --model Qwen/Qwen3-8B-Base --dataset hf:pangram/editlens_iclr \
  --split "$1" --limit "$2" --loader full --device cuda --dtype bfloat16 --batch-size 8
EOF
sbatch extract.sbatch train 4000
```

## 8. Probes and studies (CPU)

```bash
python scripts/latentlens/train_layer_probes.py --representations $R --extra-test test_llama --extra-test test_enron
python scripts/latentlens/probe_rmsnorm.py --representations $R
python scripts/latentlens/probe_components.py --representations $R
python scripts/latentlens/build_pca_artifacts.py --representations $R
python scripts/latentlens/export_web_artifacts.py
```

`train_layer_probes.py` stops if the leakage audit fails (shared ids, identical texts or EditLens `source_id` groups
across splits).

## 9. Recall experiments for Professor Regan's texts

Copyrighted texts stay on the CSE machine; `--no-store-text` keeps only statistics in the output.

```bash
python scripts/latentlens/run_recall_analysis.py --model Qwen/Qwen3-8B-Base --loader full --device cuda \
  --input /path/to/speech.txt --name "Speech" --no-store-text --out results/latentlens/recall_speech_qwen3-8b.json
python scripts/latentlens/run_recall_analysis.py ... --dtype float32 --out ..._fp32.json      # precision check
```

Comparing model sizes (model ids left open: use the exact checkpoints Professor Regan used). The adapter supports
`qwen3` with both loaders and `qwen2` / `llama` / `mistral` with `--loader full`; other families need a new adapter.

```bash
python scripts/latentlens/run_recall_analysis.py --model <model A> --loader full --input speech.txt --name "Speech" --no-store-text --out A.json
python scripts/latentlens/run_recall_analysis.py --model <model B> --loader full --input speech.txt --name "Speech" --no-store-text --out B.json
python scripts/latentlens/compare_recall_models.py A.json B.json --out results/latentlens/recall_comparison.json
```

A ~27B model in bf16 needs about 55 GB of GPU memory with `--loader full`.

## 10. Bring results back to the website

Only the small JSON files are needed (never the representation folders):

```bash
# on the CSE machine
tar czf latentlens_results.tgz results/latentlens
# on the laptop, inside the repository
scp <user>@<machine>:~/regan-chess-research/latentlens_results.tgz . && tar xzf latentlens_results.tgz
.venv-latent/Scripts/python scripts/latentlens/export_web_artifacts.py     # validates and copies to apps/web/public/data/latent
cd apps/web && npm test && npm run build
git add results/latentlens apps/web/public/data/latent && git commit -m "data: Qwen3-8B human-vs-AI probe results"
```

The website switches from "Experiment pending" to the measured charts automatically when an artifact has
`status: "ok"`.
