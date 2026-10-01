import {agentIdentity,listAgentDrafts,manageAgentDraft} from '../../../lib/agent-jobs';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){try{const auth=await agentIdentity(request);if(!auth)return Response.json({error:'로그인 후 초안을 조회해주세요.'},{status:401});return Response.json({drafts:await listAgentDrafts(auth.uid,auth.token)},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof Error?e.message:'초안 조회 실패'},{status:503});}}
export async function POST(request:Request){try{const auth=await agentIdentity(request);if(!auth)return Response.json({error:'로그인 후 초안을 관리해주세요.'},{status:401});return Response.json(await manageAgentDraft(auth.uid,auth.token,await request.json()));}catch(e){return Response.json({error:e instanceof Error?e.message:'초안 처리 실패'},{status:400});}}
