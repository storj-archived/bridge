module Helpers
  BASE_URL = "http://localhost:6382"
  # TODO: pass port via env var
  #BASE_URL = "http://localhost:#{ENV['PORT'].to_i + 1}"
  # For those who are using vagrant but not forwarding ports
  #BASE_URL = "http://172.17.200.10:#{ENV['PORT'].to_i + 1}"

  URLS = {
      root: BASE_URL,
      debits: "#{BASE_URL}/debits"
  }
end
