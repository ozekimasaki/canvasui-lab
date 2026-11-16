figma.showUI(__html__, { width: 380, height: 520 });

function colorToHex(color) {
  const to255 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const hex = [to255(color.r), to255(color.g), to255(color.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const alpha = color.a === undefined ? 1 : color.a;
  return alpha < 1 ? "#" + hex + to255(alpha).toString(16).padStart(2, "0") : "#" + hex;
}

async function resolveValue(variable, modeId, depth) {
  const raw = variable.valuesByMode[modeId];
  if (raw && typeof raw === "object" && raw.type === "VARIABLE_ALIAS") {
    if (depth > 8) return null;
    const target = await figma.variables.getVariableByIdAsync(raw.id);
    if (!target) return null;
    const targetMode =
      target.valuesByMode[modeId] !== undefined ? modeId : Object.keys(target.valuesByMode)[0];
    return resolveValue(target, targetMode, depth + 1);
  }
  return raw;
}

const TYPE_MAP = { COLOR: "color", FLOAT: "number", STRING: "string", BOOLEAN: "boolean" };

figma.ui.onmessage = async (msg) => {
  if (!msg || msg.type !== "export") return;
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    const collectionById = new Map(collections.map((c) => [c.id, c]));
    const tokens = [];
    for (const variable of variables) {
      const collection = collectionById.get(variable.variableCollectionId);
      if (!collection) continue;
      const values = {};
      for (const mode of collection.modes) {
        const resolved = await resolveValue(variable, mode.modeId, 0);
        if (resolved === null || resolved === undefined) continue;
        let value;
        if (variable.resolvedType === "COLOR") value = colorToHex(resolved);
        else if (variable.resolvedType === "FLOAT") value = resolved;
        else if (variable.resolvedType === "STRING") value = resolved;
        else if (variable.resolvedType === "BOOLEAN") value = resolved;
        else continue;
        values["mode=" + mode.name.toLowerCase()] = value;
      }
      if (Object.keys(values).length === 0) continue;
      tokens.push({
        name: variable.name.replace(/\//g, "."),
        type: TYPE_MAP[variable.resolvedType],
        collection: collection.name,
        values,
      });
    }
    figma.ui.postMessage({ type: "tokens", payload: { source: "figma", tokens } });
  } catch (e) {
    figma.ui.postMessage({ type: "error", message: String(e && e.message ? e.message : e) });
  }
};
