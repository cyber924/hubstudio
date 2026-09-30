// Accept the supervised preview's host/strict-port flags as Next.js options.
const args=process.argv.slice(2).filter(arg=>arg!=="--strictPort").map(arg=>arg==="--host"?"--hostname":arg);
if(!args.includes("--hostname"))args.push("--hostname","0.0.0.0");
process.argv=[process.execPath,new URL("../node_modules/next/dist/bin/next",import.meta.url).pathname,"dev",...args];
await import("../node_modules/next/dist/bin/next");
