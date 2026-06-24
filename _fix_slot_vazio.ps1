Add-Type -AssemblyName System.Drawing
$path='F:\projetos\farm2.0\assets\slot_vazio_bg.png'
$tmp='F:\projetos\farm2.0\assets\slot_vazio_bg_tmp.png'
$bmp=[System.Drawing.Bitmap]::new($path)
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='AntiAlias'; $g.TextRenderingHint='AntiAliasGridFit'
function Add-RoundedRect([System.Drawing.Drawing2D.GraphicsPath]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) { $d=$r*2; $path.AddArc($x,$y,$d,$d,180,90); $path.AddArc($x+$w-$d,$y,$d,$d,270,90); $path.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $path.AddArc($x,$y+$h-$d,$d,$d,90,90); $path.CloseFigure() }
$panel=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#121720'))
$gold=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#F6D36A'),4)
$gold2=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#B87914'),2)
$p=[System.Drawing.Drawing2D.GraphicsPath]::new(); Add-RoundedRect $p 28 98 356 304 24; $g.FillPath($panel,$p); $g.DrawPath($gold,$p); $p.Dispose(); $p=[System.Drawing.Drawing2D.GraphicsPath]::new(); Add-RoundedRect $p 32 102 348 296 21; $g.DrawPath($gold2,$p); $p.Dispose()
$potPen=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#4E5460'),4); $potPen.DashStyle='Dash'
$p=[System.Drawing.Drawing2D.GraphicsPath]::new(); $p.StartFigure(); $p.AddArc(122,186,160,180,190,160); $p.AddArc(128,156,148,54,15,150); $p.CloseFigure(); $g.DrawPath($potPen,$p); $p.Dispose();
$star=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#272D38')); $g.FillEllipse($star,91,140,10,10); $g.FillEllipse($star,314,140,10,10); $g.FillEllipse($star,72,270,14,8); $g.FillEllipse($star,322,270,14,8)
$white=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F1ECE1')); $goldBrush=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F5C42F')); $shadow=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0D0B08'))
$f1=[System.Drawing.Font]::new('Arial',20,[System.Drawing.FontStyle]::Bold); $f2=[System.Drawing.Font]::new('Arial',24,[System.Drawing.FontStyle]::Bold); $fmt=[System.Drawing.StringFormat]::new(); $fmt.Alignment='Center'; $fmt.LineAlignment='Center'
$g.DrawString('Adicione um', $f1, $shadow, [System.Drawing.RectangleF]::new(82, 212, 248, 34), $fmt)
$g.DrawString('Adicione um', $f1, $white, [System.Drawing.RectangleF]::new(80, 210, 248, 34), $fmt)
$g.DrawString('Pote', $f2, $shadow, [System.Drawing.RectangleF]::new(78, 250, 250, 38), $fmt)
$g.DrawString('Pote', $f2, $goldBrush, [System.Drawing.RectangleF]::new(76, 248, 250, 38), $fmt)
$g.DrawString('para começar', $f2, $shadow, [System.Drawing.RectangleF]::new(70, 292, 266, 40), $fmt)
$g.DrawString('para começar', $f2, $white, [System.Drawing.RectangleF]::new(68, 290, 266, 40), $fmt)
$fmt.Dispose(); $f1.Dispose(); $f2.Dispose(); $white.Dispose(); $goldBrush.Dispose(); $shadow.Dispose(); $star.Dispose(); $potPen.Dispose(); $gold.Dispose(); $gold2.Dispose(); $panel.Dispose(); $g.Dispose();
$bmp.Save($tmp,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); Move-Item -Force $tmp $path
