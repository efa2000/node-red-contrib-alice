import { Node, NodeDef } from "node-red";

// ==================== Конфигурации нод ====================

export interface AliceServiceConfig extends NodeDef {
  name: string;
}

export interface AliceDeviceConfig extends NodeDef {
  service: string;
  name: string;
  description: string;
  room: string;
  dtype: string;
}

export interface AliceCapabilityConfig extends NodeDef {
  device: string;
  name: string;
  response?: boolean;
  instance?: string;
}

export interface AliceOnOffConfig extends AliceCapabilityConfig {
  split?: boolean;
}

export interface AliceRangeConfig extends AliceCapabilityConfig {
  retrievable: boolean;
  unit: string;
  min: string;
  max: string;
  precision: string;
}

export interface AliceColorConfig extends AliceCapabilityConfig {
  color_support?: boolean;
  scheme: string;
  temperature_k?: boolean;
  temperature_min: string;
  temperature_max: string;
  color_scene?: string[];
}

export interface AliceModeConfig extends AliceCapabilityConfig {
  modes: string[];
}

export interface AliceSensorConfig extends NodeDef {
  device: string;
  name: string;
  stype: string;
  instance: string;
  unit: string;
}

export interface AliceEventConfig extends NodeDef {
  device: string;
  name: string;
  instance: string;
  events: string[];
}

export interface AliceVideoConfig extends NodeDef {
  device: string;
  name: string;
  stream_url: string;
  protocol: string;
}

// ==================== Типы состояний ====================

export interface CapabilityState {
  id?: string;
  type: string;
  state: {
    instance: string;
    value: any;
    relative?: boolean;
  };
}

export interface SensorState {
  id?: string;
  type: string;
  state: {
    instance: string;
    value: any;
  };
}

// ==================== Конфигурация умения/сенсора для регистрации ====================

export interface CapabilityRegistration {
  id?: string;
  type: string;
  retrievable: boolean;
  reportable: boolean;
  parameters: Record<string, any>;
}

export interface SensorRegistration {
  id?: string;
  type: string;
  retrievable: boolean;
  reportable: boolean;
  parameters: Record<string, any>;
}

// ==================== Интерфейсы нод ====================

export interface AliceServiceNode extends Node {
  credentials: {
    email: string;
    id: string;
    password: string;
    token: string;
  };
  isOnline: boolean;
  getToken(): string;
  send2gate(topic: string, data: string, retain: boolean): void;
  on(event: string, listener: (...args: any[]) => void): this;
}

export interface AliceDeviceNode extends Node {
  initState: boolean;
  setCapability(capId: string, capab: CapabilityRegistration): Promise<boolean>;
  setSensor(sensId: string, sensor: SensorRegistration): Promise<boolean>;
  updateCapabState(capId: string, state: CapabilityState): Promise<boolean>;
  updateSensorState(sensId: string, state: SensorState): Promise<boolean>;
  delCapability(capId: string): Promise<boolean>;
  delSensor(sensId: string): Promise<boolean>;
  on(event: string, listener: (...args: any[]) => void): this;
}

// ==================== Конфигурация устройства для шлюза ====================

export interface DeviceConfig {
  id: string;
  name: string;
  description: string;
  room: string;
  type: string;
  device_info: {
    manufacturer: string;
    model: string;
    sw_version: string;
  };
  capabilities: CapabilityRegistration[];
  properties: SensorRegistration[];
}

export interface DeviceStates {
  id: string;
  capabilities: CapabilityState[];
  properties: SensorState[];
}
