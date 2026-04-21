import fs from "node:fs/promises";

const [pyproject, trainCfg, sampleData, trainPy, inferPy, readme] = await Promise.all([
  fs.readFile("pyproject.toml", "utf8"),
  fs.readFile("config/train.yaml", "utf8"),
  fs.readFile("data/sample.jsonl", "utf8"),
  fs.readFile("train.py", "utf8"),
  fs.readFile("infer.py", "utf8"),
  fs.readFile("README.md", "utf8"),
]);

for (const dep of ["peft", "transformers", "bitsandbytes", "datasets", "accelerate", "trl"]) {
  if (!pyproject.includes(dep)) {
    throw new Error(`pyproject.toml missing ${dep}`);
  }
}

for (const key of ["base_model_id", "lora:", "target_modules", "num_train_epochs", "learning_rate"]) {
  if (!trainCfg.includes(key)) {
    throw new Error(`config/train.yaml missing ${key}`);
  }
}
if (!trainCfg.includes("r:") || !trainCfg.includes("alpha:")) {
  throw new Error("config/train.yaml must declare lora r and alpha");
}

// data/sample.jsonl must be real JSONL with messages column
const lines = sampleData.split("\n").filter((l) => l.trim().length > 0);
if (lines.length < 3) {
  throw new Error(`data/sample.jsonl must contain at least 3 SFT rows, found ${lines.length}`);
}
for (const line of lines) {
  let row;
  try {
    row = JSON.parse(line);
  } catch (err) {
    throw new Error(`data/sample.jsonl malformed JSON line: ${line.slice(0, 60)}...`);
  }
  if (!Array.isArray(row.messages) || row.messages.length === 0) {
    throw new Error("data/sample.jsonl rows must have a messages array");
  }
}

for (const token of ["SFTTrainer", "LoraConfig", "BitsAndBytesConfig", "AutoModelForCausalLM"]) {
  if (!trainPy.includes(token)) {
    throw new Error(`train.py missing ${token}`);
  }
}
if (!trainPy.includes("--config")) {
  throw new Error("train.py must accept --config");
}

for (const token of ["PeftModel", "AutoModelForCausalLM", "--adapter", "--prompt"]) {
  if (!inferPy.includes(token)) {
    throw new Error(`infer.py missing ${token}`);
  }
}

if (!readme.includes("python train.py") || !readme.includes("python infer.py")) {
  throw new Error("README.md should document both train and infer flows");
}

console.log("lora training starter ok");
