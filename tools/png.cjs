/* Zero-dependency PNG input/output for Mesh Vision CLI.
   Supports non-interlaced 8-bit grayscale/RGB/GA/RGBA PNG. */
'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc(buf){let v=0xffffffff;for(const n of buf)v=table[(v^n)&255]^(v>>>8);return(v^0xffffffff)>>>0}
function chunk(type,data){const typeBuf=Buffer.from(type),len=Buffer.alloc(4),check=Buffer.alloc(4);
 len.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([typeBuf,data])));
 return Buffer.concat([len,typeBuf,data,check]);}
function encode(width,height,rgba){
 if(width<1||height<1||width>4096||height>4096)throw Error('Invalid PNG dimensions');
 if(rgba.length!==width*height*4)throw Error('RGBA size mismatch');
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc(height*(width*4+1));
 for(let y=0;y<height;y++)pixels.set(rgba.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
 return Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels,{level:7})),chunk('IEND',Buffer.alloc(0))]);
}
function decode(buffer){
 if(!buffer.subarray(0,8).equals(signature))throw Error('Not a PNG file');
 let offset=8,width=0,height=0,bitDepth=0,color=0,interlace=0;const parts=[];
 while(offset+12<=buffer.length){
  const len=buffer.readUInt32BE(offset),name=buffer.toString('ascii',offset+4,offset+8);
  if(len>32*1024*1024||offset+12+len>buffer.length)throw Error('Broken PNG chunk');
  const data=buffer.subarray(offset+8,offset+8+len);
  if(name==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];color=data[9];interlace=data[12];}
  if(name==='IDAT')parts.push(data);
  offset+=len+12;if(name==='IEND')break;
 }
 const comps={0:1,2:3,4:2,6:4}[color];
 if(!comps||bitDepth!==8||interlace!==0||width>4096||height>4096||!width||!height)throw Error('PNG must be non-interlaced 8-bit grayscale/RGB/RGBA');
 const data=zlib.inflateSync(Buffer.concat(parts)),rowSize=width*comps,prev=Buffer.alloc(rowSize),rgba=new Uint8ClampedArray(width*height*4);
 let at=0;
 for(let y=0;y<height;y++){
  if(at+1+rowSize>data.length)throw Error('Truncated PNG pixels');
  const filter=data[at++],row=Buffer.from(data.subarray(at,at+rowSize));at+=rowSize;
  for(let x=0;x<rowSize;x++){
   const a=x>=comps?row[x-comps]:0,b=prev[x],c=x>=comps?prev[x-comps]:0;
   let predictor=0;
   if(filter===1)predictor=a;else if(filter===2)predictor=b;
   else if(filter===3)predictor=Math.floor((a+b)/2);
   else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   else if(filter!==0)throw Error('Unsupported PNG scanline filter');
   row[x]=(row[x]+predictor)&255;
  }
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4,j=x*comps;
   if(color===0){rgba[i]=rgba[i+1]=rgba[i+2]=row[j];rgba[i+3]=255;}
   else if(color===2){rgba[i]=row[j];rgba[i+1]=row[j+1];rgba[i+2]=row[j+2];rgba[i+3]=255;}
   else if(color===4){rgba[i]=rgba[i+1]=rgba[i+2]=row[j];rgba[i+3]=row[j+1];}
   else{rgba[i]=row[j];rgba[i+1]=row[j+1];rgba[i+2]=row[j+2];rgba[i+3]=row[j+3];}
  }
  row.copy(prev);
 }
 return{width,height,rgba};
}
function write(file,w,h,data){fs.writeFileSync(file,encode(w,h,data))}
function read(file){return decode(fs.readFileSync(file))}
module.exports={encode,decode,write,read};
