import languages from "./languages.json";
import questions from "./questions.json";
import { createEngine } from "./engine";

export const engine = createEngine(languages, questions);
