"use strict";
module.exports = (RED) => {
    function AliceGet(config) {
        RED.nodes.createNode(this, config);
        const _service = RED.nodes.getNode(config.service);
    }
    RED.nodes.registerType("Alice-Get", AliceGet);
};
//# sourceMappingURL=alice-get.js.map