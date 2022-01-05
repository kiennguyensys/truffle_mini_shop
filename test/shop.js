var Shop = artifacts.require("./Shop.sol");

contract("Shop", function (accounts) {
    var shopInstance;

    it("initializes with zero-count properties", function() {
        return Shop.deployed().then(function(instance) {
            shopInstance = instance;
            return shopInstance.productsCount();
        }).then(function(count) {
            assert.equal(count, 0);
            return shopInstance.paymentsCount()
        }).then(function(count) {
            assert.equal(count, 0);
            return shopInstance.ordersCount()       
        }).then(function(count) {
            assert.equal(count, 0);
        });
    });

    it("allows a user to create a product", function() {
        return Shop.deployed().then(function(instance) {
            shopInstance = instance;
            productPrice = 1;
            productName = "Chicken Soup";
            return shopInstance.createProduct(productName, productPrice, { from: accounts[0] });
        }).then(function(receipt) {
            assert.equal(receipt.logs.length, 1, "an event was triggered");
            assert.equal(receipt.logs[0].event, "ProductCreated", "the event type is correct");
            assert.equal(receipt.logs[0].args._productId.toNumber(), 0, "the first product id is correct");
            return shopInstance.products(0);
        }).then(function(product) {
            var price = product[2];
            assert(product[1], productName, "the product's name was corrected");
            assert(product[2], productPrice, "the product's price was corrected");
            return shopInstance.productsCount();
        }).then(function(count) {
            assert.equal(count, 1, "increments the product's count");
        });
    });

    it("allows a user to send an amount of ether", function() {
        return Shop.deployed().then(function(instance) {
            shopInstance = instance;
            etherAmount = 0.2;
            return shopInstance.send(etherAmount, { from: accounts[0] });
        }).then(function(receipt) {
            assert.equal(receipt.logs.length, 1, "an event was triggered");
            assert.equal(receipt.logs[0].event, "ProductCreated", "the event type is correct");
            assert.equal(receipt.logs[0].args._productId.toNumber(), 0, "the first product id is correct");
            return shopInstance.products(0);
        }).then(function(product) {
            var price = product[2];
            assert(product[1], productName, "the product's name was corrected");
            assert(product[2], productPrice, "the product's price was corrected");
            return shopInstance.productsCount();
        }).then(function(count) {
            assert.equal(count, 1, "increments the product's count");
        });
    });

})