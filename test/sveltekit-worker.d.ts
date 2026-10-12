// The adapter output only exists after `npm run build`.
declare module '*/.svelte-kit/cloudflare/_worker.js' {
	const handler: {
		fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
	};
	export default handler;
}
