import {NodeAPI, Node, NodeDef } from "node-red";
import axios from "axios";


interface NodeAliceGetConfig
    extends NodeDef {
    service: string;
    name:string;
};

export = (RED: NodeAPI):void =>{
    function AliceGet(this:Node, config:NodeAliceGetConfig):void {
        RED.nodes.createNode(this,config);
        const service = RED.nodes.getNode(config.service);
    };

    RED.nodes.registerType("Alice-Get",AliceGet);
}