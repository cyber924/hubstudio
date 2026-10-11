import type {MetadataRoute} from 'next';
import {siteOrigin} from './lib/site-origin';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:['/','/api/content-images/'],disallow:['/api/','/studio','/my','/login']},sitemap:`${siteOrigin()}/sitemap.xml`};}
