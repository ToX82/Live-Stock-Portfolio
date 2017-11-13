<?php
$params = json_decode(file_get_contents('php://input'), true);
if (isset($params['url'])) {
    if (strpos($params['url'], 'https://finance.yahoo.com/_finance_doubledown/api') === false) {
        // Only accept queries to yahoo finance API or die
        die();
    }
    $data = file_get_contents($params['url']);
    $data = str_replace("//", "", $data);
    $data = str_replace("\\", "-", $data);
    $data = trim($data);
    echo $data;
}
