# Draws public/icon.svg, the 32x32 pixel frog holding a token (python3 tools/make-icon.py).
import math
N=32
px=[[None]*N for _ in range(N)]
def ell(x,y,cx,cy,rx,ry): return ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1
# background: deep purple fade with dithered stars and scanlines
for y in range(N):
    for x in range(N):
        t=y/(N-1)
        r=int(0x24*(1-t)+0x0b*t); g=int(0x12*(1-t)+0x0d*t); b=int(0x3a*(1-t)+0x14*t)
        if (x+y)%2==0 and y>20: r,g,b=r+3,g+6,b+6
        if y%2: r,g,b=max(0,r-4),max(0,g-4),max(0,b-4)
        px[y][x]='#%02x%02x%02x'%(r,g,b)
for (x,y) in [(3,4),(28,3),(26,14),(4,17),(29,22),(2,27)]: px[y][x]='#6a4aa0'
# floor glow: a teal stripe under the frog
for x in range(3,29):
    for y in (29,30):
        px[y][x]='#1d5a5a' if y==29 else '#123a3e'
# (no frame: the background runs to the edges, so the launcher's own mask is the only outline)
# frog
def body(x,y): return ell(x,y,16,17,11.5,8) or ell(x,y,10,9.5,4.8,4.8) or ell(x,y,22,9.5,4.8,4.8)
B='#3fe39b'; S='#25b06f'; D='#167a4a'; H='#a8f7cf'; O='#0a3a26'
for y in range(N):
    for x in range(2,N-2):
        if body(x,y):
            c=B
            if not body(x+1,y+1) or not body(x+2,y+2) and y>18: c=S
            if not body(x+1,y+1) and not body(x,y+1): c=D
            if not body(x-1,y-1): c=H
            px[y][x]=c
        elif any(body(x+dx,y+dy) for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
            px[y][x]=O
# belly lighter
for y in range(N):
    for x in range(N):
        if ell(x,y,16,20.5,7,4) and px[y][x] in (B,S): px[y][x]='#7cf0b8'
# spots
for (x,y) in [(7,16),(8,17),(24,15),(25,16),(13,12),(19,12),(6,20),(26,20)]:
    if px[y][x] in (B,S,H): px[y][x]=S
# eyes
for cx in (10,22):
    for y in range(N):
        for x in range(N):
            if ell(x,y,cx,9.5,3,3): px[y][x]='#f4f0e0'
            if ell(x,y,cx,10,1.6,1.9): px[y][x]='#14101c'
    ix=int(cx)
    px[8][ix-1]='#ffffff'; px[9][ix-1]='#ffffff' if False else px[9][ix-1]
    px[12][ix]=px[12][ix] # keep
for cx in (10,22): px[9][cx-1]='#ffffff'; px[9][cx]= '#ffffff' if False else px[9][cx]
# smile + cheeks
for x in range(11,22): 
    y=15+ (1 if 13<=x<=18 else 0)
    px[y][x]=O
px[14][10]=O; px[14][21]=O
for (x,y) in [(8,14),(9,14),(23,14),(24,14)]: px[y][x]='#ff8fb0'
# the token, held up
CX,CY,R=16,25.5,4.6
for y in range(N):
    for x in range(N):
        if ell(x,y,CX,CY,R+1,R+1) and not ell(x,y,CX,CY,R,R): px[y][x]='#5a3a08'
        elif ell(x,y,CX,CY,R,R):
            c='#fcdc3c'
            if not ell(x,y,CX,CY,R-1.2,R-1.2): c='#d89a1a' if (x+.5-CX)+(y+.5-CY)>0 else '#ffe98a'
            elif not ell(x+1,y+1,CX,CY,R-1.5,R-1.5): c='#e8b828'
            px[y][x]=c
# embossed frog face on the coin
for (x,y) in [(14,24),(17,24)]: px[y][x]='#b07a10'
for x in range(14,18): px[27][x]='#b07a10'
px[26][13]='#b07a10'; px[26][18]='#b07a10'
px[23][14]='#ffffff'
# little hands holding it up
for (x,y,c) in [(10,25,B),(10,26,S),(11,26,S),(21,25,B),(21,26,S),(20,26,S)]: px[y][x]=c
# sparkle off the coin
for (x,y) in [(24,22),(24,24),(23,23),(25,23)]: px[y][x]='#fff6c0'
px[23][24]='#ffffff'
# SVG, row runs
out=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">']
for y in range(N):
    x=0
    while x<N:
        c=px[y][x]; s=x
        while x<N and px[y][x]==c: x+=1
        out.append(f'<rect x="{s}" y="{y}" width="{x-s}" height="1" fill="{c}"/>')
out.append('</svg>')
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','public','icon.svg'),'w').write(''.join(out))
