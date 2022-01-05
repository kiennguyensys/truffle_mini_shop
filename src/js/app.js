App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    // TODO: refactor conditional
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Shop.json", function(shop) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Shop = TruffleContract(shop);
      // Connect provider to interact with contract
      App.contracts.Shop.setProvider(App.web3Provider);

      App.listenForEvents();

      return App.render();
    });
  },

  // Listen for events emitted from the contract
  listenForEvents: function() {
    App.contracts.Shop.deployed().then(function(instance) {
      // Restart Chrome if you are unable to receive this event
      // This is a known issue with Metamask
      // https://github.com/MetaMask/metamask-extension/issues/2393

      // This is also a known issue with Duplicated Chain Triggered
      // https://github.com/ChainSafe/web3.js/issues/398
      var productBlocks = new Set();

      instance.ProductCreated({remove: true}, {
        fromBlock: 'latest',
        
      }).watch(function(error, event) {
        console.log("ProductCreated triggered", event)
        // Reload when a new vote is recorded
        let blockNumber = event.blockNumber;
        if (productBlocks.has(blockNumber)) return;
        
        productBlocks.add(blockNumber);
        App.render();
      });

      var orderBlocks = new Set();

      instance.OrderChanged({}, {
        fromBlock: 'latest',
      }).watch(function(error, event) {
        console.log("OrderChanged triggered", event)
        // Reload when a new vote is recorded
        let blockNumber = event.blockNumber;
        if (orderBlocks.has(blockNumber)) return;

        orderBlocks.add(blockNumber);
        App.render();
      });
    });
  },

  render: function() {
    var shopInstance;
    var ownedProducts = Array();

    // Enum Mapping for variables in Solidity
    const orderStatusEnum = {
      0 : 'DECLINED',
      1 : 'ACCEPTED',
      2 : 'PENDING'
    }

    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    if(web3.currentProvider.enable){
      //For metamask
      web3.currentProvider.enable().then(function(acc){
          App.account = acc[0];
          $("#accountAddress").html("Your Account: " + App.account);
      });
    } else {
        App.account = web3.eth.accounts[0];
        $("#accountAddress").html("Your Account: " + App.account);
    }

    
    // Load contract data
    App.contracts.Shop.deployed().then(function(instance) {
      shopInstance = instance;
      return shopInstance.productsCount();
    }).then(function(productsCount) {
      var productsResults = $("#productsResults");
      productsResults.empty();

      for (var i = 0; i < productsCount; i++) {
        shopInstance.products(i).then(function(product) {
          var id = product[0];
          var name = product[1];
          var price = product[2];
          var productStatus = product[4];
          
          var owner;
          if (product[3] == App.account) {
            owner = 'You';
            ownedProducts.push(id);
          } else {
            owner = App.account
          }

          // Render Product Result
          var productTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + price + "</td><td>" + owner + "</td></tr>"
          productsResults.append(productTemplate);

          // Render purchase button option
          if (productStatus.toNumber() == 0 && owner != 'You') {
            var buyOption = "<td><input type='button' onclick='App.purchaseAndOrder(" + id + "," + price + ");'' id='purchaseBtn' value='Purchase' /></td>";
            productsResults.append(buyOption);
          }
        });
      }
      return shopInstance.ordersCount();
    }).then(function(ordersCount) {
      var ordersResults = $("#ordersResults");
      ordersResults.empty();

      for (var i = 0; i < ordersCount; i++) {
        shopInstance.orders(i).then(function(order) {
          var productId = order[1];
          const isMyOrder = ownedProducts.find(id => id.toNumber() == productId.toNumber());

          if (isMyOrder) {
            var orderId = order[0];
            var paymentId = order[2];
            var orderStatus = order[3];
            
            // Render Order Result
            var orderTemplate = "<tr><th>" + orderId + "</th><td>" + productId + "</td><td>" + paymentId + "</td><td>" + orderStatusEnum[orderStatus.toNumber()] + "</td></tr>"
            ordersResults.append(orderTemplate);

            // Render purchase button option
            if (orderStatus.toNumber() == 2) {
              var acceptOption = "<td><input type='button' onclick='App.acceptOrder(" + orderId + ");'' id='acceptOrderBtn' value='Accept' /></td>";
              var declineOption = "<td><input type='button' onclick='App.declineOrder(" + orderId + ");'' id='declineOrderBtn' value='Decline' /></td>";

              ordersResults.append(acceptOption);
              ordersResults.append(declineOption);
            }
          }
        });
      }
      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  mintProduct: function() {
    var productName = $('#inputName').val();
    var productPrice = $('#inputPrice').val();

    App.contracts.Shop.deployed().then(function(instance) {
      return instance.createProduct(
          productName,
          productPrice,
          { from: App.account }
      );
    }).then(function(result) {
      // Wait for votes to update
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });
  },

  purchaseAndOrder: function(productId, productPrice) {
    var shopInstance;

    App.contracts.Shop.deployed().then(function(instance) {
      shopInstance = instance;
      return shopInstance.deposit(
          productPrice,
          { from: App.account, value: productPrice }
      );
    }).then(function(purchaseReceipt) {
      return shopInstance.createOrder(
        productId,
        purchaseReceipt.logs[0].args._paymentId.toNumber(),
        { from: App.account }
      )
    }).then(function(orderReceipt) {
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });    
  },

  acceptOrder: function(orderId) {
    var shopInstance;
    App.contracts.Shop.deployed().then(function(instance) {
      shopInstance = instance;
      return shopInstance.ownerAcceptOrder(
          orderId,
          { from: App.account }
      );
    }).then(function(receipt) {
      // console.log(receipt.logs[0].args._orderId.toNumber());
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    }); 
  },

  declineOrder: function(orderId) {
    var shopInstance;
    App.contracts.Shop.deployed().then(function(instance) {
      shopInstance = instance;
      return shopInstance.ownerDenyOrder(
          orderId,
          { from: App.account }
      );
    }).then(function(receipt) {
      // console.log(receipt.logs[0].args._orderId.toNumber());
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    }); 
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
