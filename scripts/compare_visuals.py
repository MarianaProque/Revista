from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw
import json

root=Path(__file__).resolve().parents[1]/'tmp/pdfs'
reference=Image.open(root/'reference-long.png').convert('RGB')
contact=Image.new('RGB',(1800,1280),'white')
metrics=[]
for i in range(25):
    expected=reference.crop((0,i*256,360,(i+1)*256))
    actual=Image.open(root/f'check-{i+1:02}.png').convert('RGB').resize((360,256))
    score=sum(ImageStat.Stat(ImageChops.difference(expected,actual)).mean)/3
    metrics.append({'page':i+1,'mean_pixel_error':round(score,2)})
    contact.paste(actual,((i%5)*360,(i//5)*256))
contact.save(root/'contact-web.png')
(root/'visual-comparison.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
print(json.dumps(metrics,indent=2))
