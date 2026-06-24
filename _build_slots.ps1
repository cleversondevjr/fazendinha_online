Add-Type -AssemblyName System.Drawing

$assets = 'F:\projetos\farm2.0\assets'

function New-Brush($colorHex) { [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($colorHex)) }
function New-Pen($colorHex, [float]$width) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($colorHex), $width)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pen
}
function Add-RoundedRect([System.Drawing.Drawing2D.GraphicsPath]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}
function Fill-RoundedRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); Add-RoundedRect $p $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose()
}
function Draw-RoundedRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); Add-RoundedRect $p $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose()
}
function DrawCenteredText($g, [string]$text, [System.Drawing.Font]$font, $brush, [float]$x, [float]$y, [float]$w, [float]$h) {
  $fmt=[System.Drawing.StringFormat]::new(); $fmt.Alignment='Center'; $fmt.LineAlignment='Center';
  $g.DrawString($text,$font,$brush,[System.Drawing.RectangleF]::new($x,$y,$w,$h),$fmt); $fmt.Dispose()
}
function DrawLeafCluster($g,[float]$x,[float]$y,[bool]$right){
  $leafFill=New-Brush '#4FA51E'; $leafStroke=New-Pen '#B8F05E' 1.2
  $offsets=@(@(0,6),@(14,0),@(22,10))
  foreach($o in $offsets){
    $lx=$x + ($(if($right){-$o[0]}else{$o[0]}))
    $ly=$y + $o[1]
    $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $p.AddEllipse($lx,$ly,22,14); $g.FillPath($leafFill,$p); $g.DrawPath($leafStroke,$p); $p.Dispose()
  }
  $leafFill.Dispose(); $leafStroke.Dispose()
}
function Draw-SlotBase($g,[int]$width,[int]$height){
  $g.SmoothingMode='AntiAlias'; $g.InterpolationMode='HighQualityBicubic'; $g.PixelOffsetMode='HighQuality'; $g.TextRenderingHint='AntiAliasGridFit'
  $outer=New-Brush '#0B0F14'; $inner=New-Brush '#141A23'; $panel=New-Brush '#121720'; $well=New-Brush '#171D26'
  $gold=New-Pen '#F6D36A' 4; $gold2=New-Pen '#B87914' 2; $stroke=New-Pen '#2B303A' 4; $sep=New-Pen '#4A505B' 2
  Fill-RoundedRect $g $outer 10 10 ($width-20) ($height-20) 34
  Draw-RoundedRect $g $gold 14 14 ($width-28) ($height-28) 30
  Draw-RoundedRect $g $gold2 18 18 ($width-36) ($height-36) 28
  Fill-RoundedRect $g $inner 26 26 ($width-52) ($height-52) 28
  Draw-RoundedRect $g $stroke 26 26 ($width-52) ($height-52) 28
  Fill-RoundedRect $g $panel 58 36 318 50 18
  Draw-RoundedRect $g $gold 58 36 318 50 18
  Draw-RoundedRect $g $gold2 62 40 310 42 16
  DrawLeafCluster $g 28 34 $false
  DrawLeafCluster $g 392 34 $true
  $sx=403; $sy=43
  for($i=0;$i -lt 5;$i++){ $yy=$sy+($i*73); Fill-RoundedRect $g $well $sx $yy 68 58 16; Draw-RoundedRect $g $gold $sx $yy 68 58 16; Draw-RoundedRect $g $gold2 ($sx+3) ($yy+3) 62 52 14 }
  Fill-RoundedRect $g $well 418 418 50 50 25; Draw-RoundedRect $g $gold 418 418 50 50 25; Draw-RoundedRect $g $gold2 421 421 44 44 22
  $fInfo=[System.Drawing.Font]::new('Arial',24,[System.Drawing.FontStyle]::Bold); $bInfo=New-Brush '#F2C22D'; DrawCenteredText $g 'i' $fInfo $bInfo 418 418 50 50
  Fill-RoundedRect $g $panel 28 98 356 304 24
  Draw-RoundedRect $g $gold 28 98 356 304 24
  Draw-RoundedRect $g $gold2 32 102 348 296 21
  $g.DrawLine($sep, 28, 427, 472, 427)
  Fill-RoundedRect $g $well 40 443 142 58 18
  Fill-RoundedRect $g $well 204 443 220 58 18
  Draw-RoundedRect $g $gold 40 443 142 58 18
  Draw-RoundedRect $g $gold 204 443 220 58 18
  Draw-RoundedRect $g $gold2 44 447 134 50 16
  Draw-RoundedRect $g $gold2 208 447 212 50 16
  $diamond=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(235,506),[System.Drawing.PointF]::new(249,492),[System.Drawing.PointF]::new(263,506),[System.Drawing.PointF]::new(249,520))
  $g.FillPolygon((New-Brush '#C49018'),$diamond); $g.DrawPolygon((New-Pen '#F6D36A' 3),$diamond)
  $outer.Dispose();$inner.Dispose();$panel.Dispose();$well.Dispose();$gold.Dispose();$gold2.Dispose();$stroke.Dispose();$sep.Dispose();$fInfo.Dispose();$bInfo.Dispose()
}
function Draw-PotOutline($g){
  $pen=New-Pen '#4E5460' 4; $pen.DashStyle='Dash';
  $p=[System.Drawing.Drawing2D.GraphicsPath]::new();
  $p.StartFigure(); $p.AddArc(122,186,160,180,190,160); $p.AddArc(128,156,148,54,15,150); $p.CloseFigure(); $g.DrawPath($pen,$p); $p.Dispose(); $pen.Dispose()
  $star=New-Brush '#272D38'; $g.FillEllipse($star,91,140,10,10); $g.FillEllipse($star,314,140,10,10); $g.FillEllipse($star,72,270,14,8); $g.FillEllipse($star,322,270,14,8); $star.Dispose()
}
function Draw-CenterMessage($g,$type){
  $gold=New-Brush '#F5C42F'; $white=New-Brush '#F1ECE1'; $shadow=New-Brush '#0D0B08'
  $fBig=[System.Drawing.Font]::new('Arial',30,[System.Drawing.FontStyle]::Bold)
  $fMid=[System.Drawing.Font]::new('Arial',22,[System.Drawing.FontStyle]::Bold)
  Draw-PotOutline $g
  if($type -eq 'comprar'){
    $plus=[System.Drawing.Drawing2D.GraphicsPath]::new(); $plus.AddRectangle([System.Drawing.Rectangle]::new(183,186,46,120)); $plus.AddRectangle([System.Drawing.Rectangle]::new(146,223,120,46));
    $g.FillPath($gold,$plus); $g.DrawPath((New-Pen '#FFEB9A' 4),$plus); $plus.Dispose()
    DrawCenteredText $g 'Comprar Terra' $fBig $shadow 52 320 308 46
    DrawCenteredText $g 'Comprar Terra' $fBig $gold 48 316 308 46
  } elseif($type -eq 'vazio'){
    DrawCenteredText $g 'Adicione um' $fMid $shadow 82 214 250 36
    DrawCenteredText $g 'Adicione um' $fMid $white 78 210 250 36
    DrawCenteredText $g 'Pote' $fBig $shadow 102 252 94 40
    DrawCenteredText $g 'Pote' $fBig $gold 98 248 94 40
    DrawCenteredText $g 'para' $fBig $shadow 202 252 112 40
    DrawCenteredText $g 'para' $fBig $white 198 248 112 40
    DrawCenteredText $g 'começar' $fBig $shadow 90 292 230 42
    DrawCenteredText $g 'começar' $fBig $white 86 288 230 42
  }
  $gold.Dispose();$white.Dispose();$shadow.Dispose();$fBig.Dispose();$fMid.Dispose()
}
function Save-Slot($path,$type){
  $w=486; $h=536; $bmp=[System.Drawing.Bitmap]::new($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Transparent)
  Draw-SlotBase $g $w $h; if($type -ne 'planta'){ Draw-CenterMessage $g $type }
  $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
function Save-ButtonColher($path){
  $w=300; $h=82; $bmp=[System.Drawing.Bitmap]::new($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'; $g.Clear([System.Drawing.Color]::Transparent)
  $outer=New-Brush '#14110A'; $mid=New-Brush '#B86C0A'; $inner=New-Brush '#E4911B'; $gold=New-Pen '#F8D667' 4; $gold2=New-Pen '#B87713' 2; $text=New-Brush '#F1A02A'; $shadow=New-Brush '#3A1D02'
  Fill-RoundedRect $g $outer 4 4 292 74 22; Fill-RoundedRect $g $mid 10 10 280 62 18; Fill-RoundedRect $g $inner 14 14 272 54 16; Draw-RoundedRect $g $gold 10 10 280 62 18; Draw-RoundedRect $g $gold2 14 14 272 54 16
  $font=[System.Drawing.Font]::new('Arial',28,[System.Drawing.FontStyle]::Bold); DrawCenteredText $g 'Colher' $font $shadow 0 18 $w 34; DrawCenteredText $g 'Colher' $font $text 0 14 $w 34
  $outer.Dispose();$mid.Dispose();$inner.Dispose();$gold.Dispose();$gold2.Dispose();$text.Dispose();$shadow.Dispose();$font.Dispose(); $bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
Save-Slot (Join-Path $assets 'slot_planta_bg.png') 'planta'
Save-Slot (Join-Path $assets 'slot_vazio_bg.png') 'vazio'
Save-Slot (Join-Path $assets 'slot_comprar_terra_bg.png') 'comprar'
Save-ButtonColher (Join-Path $assets 'botao_colher.png')
