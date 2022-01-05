// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

contract Shop {
    
    enum ProductStatus{ FOR_SALE, NOT_FOR_SALE }
    struct Product {
        uint id;
        string name;
        uint256 price;
        address owner;
        ProductStatus productStatus; 
    }

    struct Payment {
        uint id;
        uint256 amount;
        address buyer;
    }

    enum OrderStatus{ DENIED, ACCEPTED, PENDING }
    struct Order {
        uint id;
        uint productId;
        uint paymentId;
        OrderStatus orderStatus;
    }

    mapping (uint=>Product) public products;
    mapping (uint=>Payment) public payments;
    mapping (uint=>Order) public orders;


    uint public productsCount;
    uint public paymentsCount;
    uint public ordersCount;


    event Paid(address indexed _from, uint _value, uint _paymentId);
    event ProductCreated(uint indexed _productId);
    event OrderChanged(uint indexed _orderId);

    function withdraw(address _recipient, uint256 _amount) public {
        payable(_recipient).transfer(_amount);
    }

    function deposit(uint256 _amount) payable public {
        require(msg.value == _amount);

        createPayment(msg.value, msg.sender);
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    constructor() {
        productsCount = 0;
        ordersCount = 0;
        paymentsCount = 0;
    }
    
    function createProduct(string memory _name, uint256 _price) public {       
        products[productsCount] = 
            Product(productsCount, _name, _price, msg.sender, ProductStatus.FOR_SALE);
        emit ProductCreated(productsCount);
        productsCount ++;
    }

    function putProductOnSale(uint _productId) private {
        Product storage newProduct = products[_productId];
        newProduct.productStatus = ProductStatus.FOR_SALE;
        products[_productId] = newProduct;
    }

    function removeProductFromSale(uint _productId) private {
        Product storage newProduct = products[_productId];
        newProduct.productStatus = ProductStatus.NOT_FOR_SALE;
        products[_productId] = newProduct;
    }

    function transferProductOwnership(uint _productId, address _newOwner) private {
        Product storage newProduct = products[_productId];
        newProduct.owner = _newOwner;
        newProduct.productStatus = ProductStatus.NOT_FOR_SALE;
        products[_productId] = newProduct;
    }

    function createPayment(uint256 _amount, address _buyer) private {
        payments[paymentsCount] = 
            Payment(paymentsCount, _amount, _buyer);

        emit Paid(msg.sender, msg.value, paymentsCount);
        paymentsCount ++;
    }

    function createOrder(uint _productId, uint _paymentId) public {
        orders[ordersCount] =
            Order(ordersCount, _productId, _paymentId, OrderStatus.PENDING);
        emit OrderChanged(ordersCount);
        ordersCount ++;

        removeProductFromSale(_productId);
    }

    function ownerDenyOrder(uint _orderId) public {
        Order storage order = orders[_orderId];
        order.orderStatus = OrderStatus.DENIED;
        orders[_orderId] = order;

        //send back money to buyer
        Payment storage payment = payments[order.paymentId];
        withdraw(payment.buyer, payment.amount);

        emit OrderChanged(_orderId);
    }

    function ownerAcceptOrder(uint _orderId) public {
        Order storage order = orders[_orderId];
        order.orderStatus = OrderStatus.ACCEPTED;
        orders[_orderId] = order;

        //send money to product owner
        Product storage currentProduct = products[order.productId];
        withdraw(currentProduct.owner, currentProduct.price);

        //transfer product ownership
        Payment storage payment = payments[order.paymentId]; 
        transferProductOwnership(currentProduct.id, payment.buyer);

        emit OrderChanged(_orderId);
    }

}