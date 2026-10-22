/** Bounded ordered token diff. Whitespace is preserved but excluded from alignment. */
export function commandDiff(before: string, after: string) {
  const split = (text: string) => text.match(/\s+|\S+/gu) ?? [];
  const left = split(before), right = split(after);
  const a = left.filter(s => s.trim()), b = right.filter(s => s.trim());
  if(before.length > 8000 || after.length > 8000 || a.length > 512 || b.length > 512)
    return {supported:false,message:"Ordered diff limit exceeded (8,000 characters / 512 tokens per output). Raw outputs remain available.",left:left.map(text=>({text,changed:false})),right:right.map(text=>({text,changed:false}))};
  const width=b.length+1, dp=new Uint16Array((a.length+1)*width);
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)
    dp[i*width+j]=a[i]===b[j]?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
  const keepA=new Set<number>(),keepB=new Set<number>();let i=0,j=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){keepA.add(i++);keepB.add(j++);}else if(dp[(i+1)*width+j]>=dp[i*width+j+1])i++;else j++;}
  const mark=(parts:string[],keep:Set<number>)=>{let index=0;return parts.map(text=>({text,changed:text.trim()? !keep.has(index++):false}));};
  return {supported:true,message:"Ordered non-whitespace token diff. Highlighted tokens are removed or inserted relative to the other prediction; no semantic equivalence is inferred.",left:mark(left,keepA),right:mark(right,keepB)};
}
