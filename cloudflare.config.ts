import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "website",
		compatibilityDate: "2025-04-04",
		entrypoint: "./workers/app.ts",
		workersDev: false,
		previewUrls: false,
		// Preserve dashboard-managed vars and secrets, as Wrangler keep_vars did.
		unsafe: { metadata: { keep_bindings: ["plain_text", "json", "secret_text", "secret_key"] } },
		observability: {
			enabled: true,
		},
		domains: [
			"roseu.net",
			"home.roseu.net",
			"mc.roseu.net",
		],
		triggers: [
			triggers.queue({
				deadLetterQueue: "umigame-ai-dlq",
				maxBatchSize: 5,
				maxBatchTimeout: 2,
				maxConcurrency: 2,
				maxRetries: 3,
				name: "umigame-ai",
			}),
		],
		env: {

			CF_ACCESS_TEAM_DOMAIN: bindings.text("roseu.cloudflareaccess.com"),
			CF_ACCESS_AUD: bindings.text("96b9c9c9fd0eb49cdba0eab8b3fd4f3b987e89f5972bbfb8ec953d8f81e70549"),
			UMIGAME_ACCESS_AUD: bindings.text("be861d10bd1c5a96e3b9e3120cc86803111421eca67fa4e1fa711927901bb344"),
			JEV_INPUT_USD_PER_MILLION: bindings.text("0.042"),

			DB: bindings.d1({
				name: "mc-dashboard",
				id: "a1feedb9-f4ca-47aa-a4a3-507692c9d300",
			}),
			UMIGAME_DB: bindings.d1({
				name: "umigame",
				id: "20b0d67b-0d82-4a59-ad55-a98f2b5a702a",
			}),
			UMIGAME_AI_QUEUE: bindings.queue({
				name: "umigame-ai",
			}),
			API_SERVICE: bindings.worker({
				worker: "api",
			}),
			AI: bindings.ai({}),
			WORDLE_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026090801",
				simple: {
					limit: 60,
					period: 60,
				},
			}),
			UMIGAME_QUESTION_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092101",
				simple: {
					limit: 3,
					period: 10,
				},
			}),
			UMIGAME_GUESS_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092102",
				simple: {
					limit: 2,
					period: 10,
				},
			}),
			UMIGAME_RECOMMEND_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092201",
				simple: {
					limit: 2,
					period: 10,
				},
			}),
			UMIGAME_QUESTION_USER_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092302",
				simple: {
					limit: 3,
					period: 10,
				},
			}),
			UMIGAME_QUESTION_ANON_IP_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092303",
				simple: {
					limit: 6,
					period: 10,
				},
			}),
			UMIGAME_GUESS_USER_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092304",
				simple: {
					limit: 2,
					period: 10,
				},
			}),
			UMIGAME_GUESS_ANON_IP_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092305",
				simple: {
					limit: 4,
					period: 10,
				},
			}),
			UMIGAME_RECOMMEND_USER_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092306",
				simple: {
					limit: 2,
					period: 10,
				},
			}),
			UMIGAME_RECOMMEND_ANON_IP_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092307",
				simple: {
					limit: 4,
					period: 10,
				},
			}),
			UMIGAME_SESSION_START_USER_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092308",
				simple: {
					limit: 30,
					period: 60,
				},
			}),
			UMIGAME_SESSION_START_ANON_IP_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092309",
				simple: {
					limit: 20,
					period: 60,
				},
			}),
			JEV_TOOL_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092310",
				simple: {
					limit: 2,
					period: 10,
				},
			}),
			CONTACT_RATE_LIMITER: bindings.rateLimit({
				namespace: "2026092401",
				simple: {
					limit: 2,
					period: 60,
				},
			}),
		},
	},
});
