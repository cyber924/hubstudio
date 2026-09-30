/** Standard uncompressed ZIP; preserves original image bytes and UTF-8 filenames. */
export function imageZip(files: {name:string;bytes:Uint8Array}[]): Uint8Array {
  const enc=new TextEncoder(),parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0,centralSize=0;
  const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  for(const file of files){
    const name=enc.encode(file.name),checksum=crc(file.bytes),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);
    lv.setUint32(14,checksum,true);lv.setUint32(18,file.bytes.length,true);lv.setUint32(22,file.bytes.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
    const entry=new Uint8Array(46+name.length),ev=new DataView(entry.buffer);
    ev.setUint32(0,0x02014b50,true);ev.setUint16(4,20,true);ev.setUint16(6,20,true);ev.setUint16(8,0x800,true);ev.setUint16(14,33,true);
    ev.setUint32(16,checksum,true);ev.setUint32(20,file.bytes.length,true);ev.setUint32(24,file.bytes.length,true);ev.setUint16(28,name.length,true);ev.setUint32(42,offset,true);entry.set(name,46);
    parts.push(local,file.bytes);central.push(entry);offset+=local.length+file.bytes.length;centralSize+=entry.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  const output=new Uint8Array(offset+centralSize+22);let pos=0;for(const part of [...parts,...central,end]){output.set(part,pos);pos+=part.length;}return output;
}
