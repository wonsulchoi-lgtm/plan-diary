<?php
// 이 파일을 config.php 로 이름을 바꾸고 값을 채워 서버에 올리세요.
// ※ 3일차 앱(/quest/config.php)이 이미 서버에 있으면 이 파일은 없어도 됩니다 — api.php가 그 키를 같이 씁니다.
return [
    'anthropic_api_key'      => 'sk-ant-여기에-키를-넣으세요',
    'model'                  => 'claude-opus-5-5',  // 느리면 'claude-sonnet-5-5'
    'plan_per_nick_per_hour' => 30,    // 학생(팀/닉네임) 한 명이 1시간에 부를 수 있는 횟수
    'ai_total_per_day'       => 3000,  // 사이트 전체 하루 최대 횟수
];
