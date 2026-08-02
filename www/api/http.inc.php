<?php
  // Shared request-side helpers for the services in this directory.
  // The response protocol still lives in each handler; ajax.php only routes.

  const EMPTY_PARAMS_RESPONSE = "3\nempty";

  // function that picks the given parameter's value from the request
function getVar($var, $type)
{
    $value = filter_input(INPUT_GET, $var);
    if ($value === null) {
        $value = filter_input(INPUT_POST, $var);
    }

    if ($value === null) {
        return false;
    }

    switch ($type) {
        case 'str':
            $result = htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
            break;

        case 'int':
            $result = filter_var($value, FILTER_VALIDATE_INT);
            break;

        case 'float':
            $result = filter_var($value, FILTER_VALIDATE_FLOAT);
            break;

        default:
            $result = false;
    }

    return $result;
}
