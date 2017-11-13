<?php
$params = json_decode(file_get_contents('php://input'), true);
if (isset($params['url'])) {
    if (strpos($params['url'], 'https://finance.yahoo.com/_finance_doubledown/api') !== 0) {
        // Only accept queries to yahoo finance API or die
        header('HTTP/1.0 404 Not Found');
        die();
    }
    $data = file_get_contents($params['url']);
    $data = str_replace("//", "", $data);
    $data = str_replace("\\", "-", $data);
    $data = trim($data);
    echo $data;
}
