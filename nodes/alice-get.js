"use strict";
;
module.exports = (RED) => {
    function AliceGet(config) {
        RED.nodes.createNode(this, config);
        const service = RED.nodes.getNode(config.service);
    }
    ;
    RED.nodes.registerType("Alice-Get", AliceGet);
};
