Given /^the bridge server is running$/ do
  test_response = ''

  while test_response.blank? do
    begin
      test_response = RestClient.get(URLS[:root]).to_str
    rescue
    ensure
      sleep 0.5
    end
  end
end
