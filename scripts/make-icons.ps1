Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$publicRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'public')).Path

foreach ($size in @(192, 512)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#102a43'))
  $graphics.FillRectangle($background, 0, 0, $size, $size)

  $inset = [int]($size * 0.16)
  $strokeWidth = [Math]::Max(2, [int]($size * 0.012))
  $teal = [System.Drawing.ColorTranslator]::FromHtml('#15a085')
  $pen = [System.Drawing.Pen]::new($teal, $strokeWidth)
  $radius = [int]($size * 0.16)
  $diameter = $radius * 2
  $rectSize = $size - ($inset * 2)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($inset, $inset, $diameter, $diameter, 180, 90)
  $path.AddArc($inset + $rectSize - $diameter, $inset, $diameter, $diameter, 270, 90)
  $path.AddArc($inset + $rectSize - $diameter, $inset + $rectSize - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($inset, $inset + $rectSize - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.DrawPath($pen, $path)

  $font = [System.Drawing.Font]::new('Segoe UI', [single]($size * 0.39), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $graphics.DrawString('م', $font, $textBrush, [System.Drawing.RectangleF]::new(0, [single](-$size * 0.025), $size, $size), $format)

  $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#d8b46a'))
  $dot = [int]($size * 0.045)
  $graphics.FillEllipse($dotBrush, [int]($size * 0.72), [int]($size * 0.72), $dot, $dot)

  $output = Join-Path $publicRoot "icon-$size.png"
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)

  $dotBrush.Dispose()
  $textBrush.Dispose()
  $format.Dispose()
  $font.Dispose()
  $path.Dispose()
  $pen.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
