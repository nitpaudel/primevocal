# PRIME VOCAL · zero-install static server for local preview.
# Node isn't installed on this machine, so this does the same job using
# only what ships with Windows. Run it, then open http://localhost:3000
#
#   powershell -ExecutionPolicy Bypass -File serve.ps1
#
# Stop it with Ctrl+C.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 3000

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.js'    = 'application/javascript; charset=utf-8'
  '.mjs'   = 'application/javascript; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.svg'   = 'image/svg+xml'
  '.ico'   = 'image/x-icon'
  '.mp3'   = 'audio/mpeg'
  '.woff'  = 'font/woff'
  '.woff2' = 'font/woff2'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Host "PRIME VOCAL server running at http://localhost:$port"
Write-Host "Serving $root"
Write-Host "Ctrl+C to stop."

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $buf = New-Object byte[] 8192
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { continue }

    $req  = [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
    $line = ($req -split "`r`n")[0]
    $parts = $line -split ' '
    $url = if ($parts.Count -ge 2) { $parts[1] } else { '/' }

    # Drop the query string and fragment. The asset links carry ?v=NN
    # cache-busters, and without this every one of them 404s.
    $url = ($url -split '\?')[0]
    $url = ($url -split '#')[0]
    $url = [System.Uri]::UnescapeDataString($url)
    if ($url -eq '/' -or $url -eq '') { $url = '/index.html' }

    $rel  = $url.TrimStart('/').Replace('/', '\')
    $path = Join-Path $root $rel

    $full = $null
    try { $full = [System.IO.Path]::GetFullPath($path) } catch {}
    $rootFull = [System.IO.Path]::GetFullPath($root)

    # keep requests inside the site folder
    $ok = $full -and
          $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -and
          (Test-Path -LiteralPath $full -PathType Leaf)

    if ($ok) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      Write-Host "200 $url"
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
      Write-Host "404 $url"
    }

    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } catch {
  } finally {
    $client.Close()
  }
}
