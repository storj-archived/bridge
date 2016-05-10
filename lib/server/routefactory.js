'use strict';

module.exports = function RouteFactory(config, storage, network, mailer) {
  return ([
    require('./routes/buckets'),
    require('./routes/pubkeys'),
    require('./routes/users'),
    require('./routes/frames')
  ]).map(function(Router) {
    return Router(config, storage, network, mailer).getEndpointDefinitions();
  }).reduce(function(set1, set2) {
    return set1.concat(set2);
  }, []);
};
