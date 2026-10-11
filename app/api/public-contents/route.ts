import {getPublicContents} from '../../lib/public-content';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({posts:await getPublicContents()},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'공개 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'},{status:503});}}
