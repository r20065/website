<?php
function GetFileName(){
    $filename = "./" . "highscore.csv";
    return $filename;
}
 
$allData = file_get_contents(GetFileName());
echo $allData;