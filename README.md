# Tempus Sers

## Testing

### Unit Tests
To run unit tests, simply execute `yarn test`.

### Integration Tests
Our integration tests run against a local network that is forked off of the Ethereum Mainnet. Follow these steps to run them:

* Set the `ETH_NODE_URI_MAINNET` environment variable to an archive mainnet Ethereum node URI.
* Execute `yarn test:integration`. 