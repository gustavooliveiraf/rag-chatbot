type LogFields = Record<string, unknown>;

function emit(level: "info" | "error", message: string, fields?: LogFields) {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };
  const out = JSON.stringify(line);
  if (level === "error") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
