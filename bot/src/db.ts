import { readFile, writeFile } from "fs/promises";
import { DB_PATH } from "./config";

export type ScheduledRecording = Readonly<{
  id: string;
  url: string;
  name: string | null;
  type: string;
  timestamp: number;
  scheduledBy: string;
  channel: string;
  creationTimestamp: number;
}>;

interface Database {
  scheduledRecordings: { [key: string]: Omit<ScheduledRecording, "id"> };
  pastRecordings: {
    [key: string]: Omit<ScheduledRecording & { used?: true }, "id">;
  };
}

const initDb = async (): Promise<Database> => {
  const object: Database = { scheduledRecordings: {}, pastRecordings: {} };
  await writeFile(DB_PATH, JSON.stringify(object, undefined, 1), {
    encoding: "utf8",
  });
  return object;
};

const loadDb = async (): Promise<Database> => {
  try {
    const parsed = JSON.parse(await readFile(DB_PATH, { encoding: "utf8" }));
    return parsed;
  } catch (e) {
    if (e.code === "ENOENT") {
      console.warn("Database load failed, attempt to initialize empty");
      return await initDb();
    }

    console.error("Database load failed", e.message);
    process.exit(1);
  }
};

let instance: Database = null;
loadDb().then((db) => (instance = db));

const saveDb = async () => {
  await writeFile(DB_PATH, JSON.stringify(instance, undefined, 1), {
    encoding: "utf8",
  });
};

const getRandomId = () =>
  ((Math.random() * 0xffff) | 0).toString(16).padStart(2, "0");

export const scheduleNewRecording = async (
  data: Omit<ScheduledRecording, "id" | "creationTimestamp">
): Promise<ScheduledRecording> => {
  if (data.timestamp < Date.now())
    throw new Error(`Attempt to schedule recording in the past`);

  let id: string;
  do {
    id = getRandomId();
  } while (
    instance.scheduledRecordings[id] !== undefined ||
    instance.pastRecordings[id] !== undefined
  );

  delete data["id"];
  const object = (instance.scheduledRecordings[id] = {
    creationTimestamp: Date.now(),
    ...data,
  });
  await saveDb();

  return { id, ...object };
};

export const popFromThePast = async (): Promise<
  ReadonlyArray<ScheduledRecording>
> => {
  const now = Date.now();
  const toReturn = Object.entries(instance.scheduledRecordings)
    .filter((e) => e[1].timestamp < now)
    .map((e) => ({ id: e[0], ...e[1] }));

  if (toReturn.length > 0) {
    for (const e of toReturn) delete instance.scheduledRecordings[e.id];
    await saveDb();
  }

  return toReturn;
};

export const addToPast = async ({ id, ...record }: ScheduledRecording) => {
  instance.pastRecordings[id] = record;
  await saveDb();
};

export const getAll = (): ReadonlyArray<ScheduledRecording> => {
  const toReturn = Object.entries(instance.scheduledRecordings)
    .map((e) => ({ id: e[0], ...e[1] }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return toReturn;
};

export const findById = (id: string): ScheduledRecording | null => {
  const found = instance.scheduledRecordings[id];
  if (found) return { id, ...found };
  return null;
};

export const findByNameExact = (name: string): ScheduledRecording | null => {
  const result = Object.entries(instance.scheduledRecordings).find(
    ([_, v]) => v.name === name
  );
  if (result) {
    const [id, found] = result;
    return { id, ...found };
  }
  return null;
};

export const deleteById = async (
  id: string
): Promise<ScheduledRecording | null> => {
  const found = instance.scheduledRecordings[id];
  if (found) {
    delete instance.scheduledRecordings[id];
    await saveDb();
    return { id, ...found };
  }
  return null;
};

export const findInPastIfNotUsedByIdAndMarkUsed = async (
  id: string
): Promise<ScheduledRecording | null> => {
  const found = instance.pastRecordings[id];
  if (found && found.used === undefined) {
    instance.pastRecordings[id] = { ...found, used: true };
    await saveDb();
    return { id, ...found };
  }
  return null;
};

export const findInPastIfNotUsedById = (
  id: string
): ScheduledRecording | null => {
  const found = instance.pastRecordings[id];
  if (found && found.used === undefined) {
    return { id, ...found };
  }
  return null;
};
