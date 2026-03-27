import path from "node:path";
import { composeStarter } from "./compose.mjs";
import { createTempDir, listFilesRecursive, readJson, removeDir, writeJson } from "./fs.mjs";

export async function createContextPack({ spec, outDir = null }) {
  const composedDir = outDir ?? (await createTempDir("starter-foundry-context"));
  const cleanup = !outDir;
  const composeResult = await composeStarter({ spec, outDir: composedDir });

  try {
    const composeReport = await readJson(composeResult.composeReportPath);
    const files = await listFilesRecursive(composedDir);
    const contextPack = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      projectName: spec.projectName,
      components: composeReport.components,
      variables: composeReport.variables,
      files,
      fileOwnership: composeReport.fileOwnership,
      commands: composeReport.contextHints.commands,
      entrypoints: composeReport.contextHints.entrypoints,
      preview: composeReport.contextHints.preview,
      extensionPoints: composeReport.contextHints.extensionPoints,
      validationChecks: composeReport.validationChecks,
      agentBrief: {
        summary: `Starter ${composeReport.components.family} with ${composeReport.components.layers.length} layers and partner ${composeReport.components.partner ?? "none"}.`,
        firstMoves: [
          "Read the entrypoints first.",
          "Run one of the validated commands before making changes.",
          "Prefer extending owned files before replacing core family files.",
        ],
      },
    };

    const contextPath = path.join(composedDir, ".starter-foundry", "context-pack.json");
    await writeJson(contextPath, contextPack);

    return {
      outDir: composedDir,
      contextPath,
      contextPack,
    };
  } finally {
    if (cleanup) {
      await removeDir(composedDir);
    }
  }
}

