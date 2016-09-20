Given /^the bridge server is running$/ do
  while @test_response.blank? do
    @test_response = RestClient.get(URLS[:root]).to_str
    @test_response.present?
  end
end