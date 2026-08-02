<?php
  // The response protocol shared by every service in this directory.
  //
  // Success is a 2xx and the resource itself, with no envelope around it.
  // Failure is a 4xx/5xx and {"error":{"code":"...","message":"..."}}, where
  // `code` is the stable, machine-readable name the client keys off and
  // `message` is English prose for DevTools and the logs - it is never shown
  // to a user. The localized text lives in www/locale/*.json, keyed by `code`.

  /**
   * Anything a handler cannot fulfil. The status says what kind of failure it
   * is to HTTP; the code says which one it is to the client.
   */
  class ApiError extends Exception
  {
      private $status;
      private $errorCode;

      public function __construct($status, $errorCode, $message = '')
      {
          parent::__construct($message === '' ? $errorCode : $message);
          $this->status = $status;
          $this->errorCode = $errorCode;
      }

      public function getStatus()
      {
          return $this->status;
      }

      public function getErrorCode()
      {
          return $this->errorCode;
      }
  }

  /** The only place in the endpoint that writes to the output. */
  function respondJson($status, $data)
  {
      http_response_code($status);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode($data);
  }

  function apiErrorBody($code, $message)
  {
      return array('error' => array('code' => $code, 'message' => $message));
  }

  /**
   * Reads one parameter out of the given source - $_GET or $_POST, chosen by
   * the route, never $_REQUEST. Returns NULL when the parameter is absent or
   * malformed for the requested type; an empty string is a present value.
   *
   * Values are validated, never escaped. Escaping belongs at the point of
   * output, and the only output here is json_encode, which escapes on its own.
   */
  function getParam($source, $name, $type)
  {
      if (!isset($source[$name]) || !is_string($source[$name])) {
          return null;
      }
      $value = trim($source[$name]);

      switch ($type) {
          case 'str':
              return $value;

          case 'int':
              $result = filter_var($value, FILTER_VALIDATE_INT);
              return $result === false ? null : $result;

          case 'float':
              $result = filter_var($value, FILTER_VALIDATE_FLOAT);
              return $result === false ? null : $result;

          default:
              return null;
      }
  }

  /** getParam() for a parameter the handler cannot work without. */
  function requireParam($source, $name, $type, $errorCode = 'missing_params')
  {
      $value = getParam($source, $name, $type);
      if ($value === null) {
          throw new ApiError(400, $errorCode, "Missing or malformed parameter: $name");
      }
      return $value;
  }

  /**
   * Picks the handler for the requested service and hands it the parameters of
   * the single method that service accepts.
   *
   * The route table binds a method to each service on purpose: the services
   * with a side effect take POST only, so a plain <img src="/ajax.php?..."> on
   * someone else's page can no longer send mail. And the service name is read
   * from $_GET/$_POST explicitly rather than from $_REQUEST, which also carries
   * cookies - a cookie named `service` used to be able to decide the route.
   */
  function dispatch($routes)
  {
      $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

      $service = null;
      if (isset($_GET['service']) && is_string($_GET['service'])) {
          $service = $_GET['service'];
      } elseif (isset($_POST['service']) && is_string($_POST['service'])) {
          $service = $_POST['service'];
      }

      if ($service === null || $service === '') {
          throw new ApiError(400, 'missing_service', 'No service given');
      }
      if (!isset($routes[$service])) {
          throw new ApiError(404, 'unknown_service', "Unknown service: $service");
      }

      list($allowedMethod, $handler) = $routes[$service];
      if ($method !== $allowedMethod) {
          header('Allow: ' . $allowedMethod);
          throw new ApiError(405, 'method_not_allowed', "$service accepts $allowedMethod only");
      }

      return $handler($allowedMethod === 'POST' ? $_POST : $_GET);
  }
