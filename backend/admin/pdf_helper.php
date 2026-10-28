<?php


function pdf_escape($text) {
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $text);
}


function build_simple_pdf($title, $lines) {
    $pageWidth  = 612; // US Letter
    $pageHeight = 792;
    $marginTop  = 740;
    $lineHeight = 16;
    $bottomLimit = 50;

    $content = "BT\n/F1 16 Tf\n50 {$marginTop} Td\n(" . pdf_escape($title) . ") Tj\nET\n";

    $y = $marginTop - 34;
    $content .= "BT\n/F1 10 Tf\n";
    $first = true;
    foreach ($lines as $line) {
        if ($y < $bottomLimit) {
            break; // single-page report; stop rather than overflow
        }
        if ($first) {
            $content .= "50 {$y} Td\n";
            $first = false;
        } else {
            $content .= "0 -{$lineHeight} Td\n";
        }
        $content .= "(" . pdf_escape($line) . ") Tj\n";
        $y -= $lineHeight;
    }
    $content .= "ET\n";

    $objects = [];
    $objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    $objects[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    $objects[3] = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$pageWidth} {$pageHeight}] "
                . "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n";
    $len = strlen($content);
    $objects[4] = "4 0 obj\n<< /Length {$len} >>\nstream\n{$content}endstream\nendobj\n";
    $objects[5] = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objects as $num => $obj) {
        $offsets[$num] = strlen($pdf);
        $pdf .= $obj;
    }
    $xrefStart = strlen($pdf);
    $count = count($objects) + 1;

    $pdf .= "xref\n0 {$count}\n0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= str_pad((string) $offsets[$i], 10, "0", STR_PAD_LEFT) . " 00000 n \n";
    }
    $pdf .= "trailer\n<< /Size {$count} /Root 1 0 R >>\nstartxref\n{$xrefStart}\n%%EOF";

    return $pdf;
}


function send_pdf_download($conn, $filename, $title, $lines) {
    $pdf = build_simple_pdf($title, $lines);

    // config.php already sent a JSON content-type header; override it.
    header_remove('Content-Type');
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
    if (isset($conn)) {
        mysqli_close($conn);
    }
    exit();
}
