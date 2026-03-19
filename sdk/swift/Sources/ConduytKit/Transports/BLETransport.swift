import Foundation
import CoreBluetooth

/// CONDUYT BLE Transport using CoreBluetooth.
///
/// Connects to a CONDUYT device advertising the CONDUYT BLE service.
/// Uses COBS framing over BLE characteristics.
@available(iOS 15.0, macOS 12.0, *)
public class BLETransport: NSObject, ConduytTransport, CBCentralManagerDelegate, CBPeripheralDelegate {

    public static let serviceUUID = CBUUID(string: "6e400001-b5a3-f393-e0a9-e50e24dcca9e")
    public static let txCharUUID  = CBUUID(string: "6e400002-b5a3-f393-e0a9-e50e24dcca9e")
    public static let rxCharUUID  = CBUUID(string: "6e400003-b5a3-f393-e0a9-e50e24dcca9e")

    private var centralManager: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var txChar: CBCharacteristic?
    private var rxChar: CBCharacteristic?
    private var handler: ((Data) -> Void)?
    private var connectContinuation: CheckedContinuation<Void, Error>?
    private var rxBuffer = Data()

    public private(set) var connected = false
    public let needsCOBS = true

    private let targetName: String?
    private let targetUUID: UUID?

    /// Create a BLE transport targeting a specific device name or UUID.
    public init(name: String? = nil, uuid: UUID? = nil) {
        self.targetName = name
        self.targetUUID = uuid
        super.init()
        self.centralManager = CBCentralManager(delegate: self, queue: nil)
    }

    public func connect() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.connectContinuation = continuation
            if centralManager.state == .poweredOn {
                startScan()
            }
        }
    }

    public func disconnect() async throws {
        if let peripheral = peripheral {
            centralManager.cancelPeripheralConnection(peripheral)
        }
        connected = false
        peripheral = nil
        txChar = nil
        rxChar = nil
    }

    public func send(_ packet: Data) async throws {
        guard let txChar = txChar, let peripheral = peripheral else {
            throw ConduytTransportError.notConnected
        }
        let encoded = COBS.encode(packet)
        var frame = encoded
        frame.append(0x00)
        peripheral.writeValue(frame, for: txChar, type: .withResponse)
    }

    public func onReceive(_ handler: @escaping (Data) -> Void) {
        self.handler = handler
    }

    private func startScan() {
        centralManager.scanForPeripherals(withServices: [Self.serviceUUID])
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn && connectContinuation != nil {
            startScan()
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                                advertisementData: [String: Any], rssi: NSNumber) {
        let match: Bool
        if let targetName = targetName {
            match = peripheral.name == targetName
        } else if let targetUUID = targetUUID {
            match = peripheral.identifier == targetUUID
        } else {
            match = true // connect to first found
        }

        guard match else { return }
        central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([Self.serviceUUID])
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectContinuation?.resume(throwing: error ?? ConduytTransportError.connectionFailed)
        connectContinuation = nil
    }

    // MARK: - CBPeripheralDelegate

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let service = peripheral.services?.first(where: { $0.uuid == Self.serviceUUID }) else { return }
        peripheral.discoverCharacteristics([Self.txCharUUID, Self.rxCharUUID], for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        for char in service.characteristics ?? [] {
            if char.uuid == Self.txCharUUID { txChar = char }
            if char.uuid == Self.rxCharUUID {
                rxChar = char
                peripheral.setNotifyValue(true, for: char)
            }
        }
        if txChar != nil && rxChar != nil {
            connected = true
            connectContinuation?.resume()
            connectContinuation = nil
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard characteristic.uuid == Self.rxCharUUID, let data = characteristic.value else { return }
        rxBuffer.append(data)

        while let delimIdx = rxBuffer.firstIndex(of: 0x00) {
            let frame = rxBuffer[rxBuffer.startIndex..<delimIdx]
            rxBuffer = Data(rxBuffer[(delimIdx + 1)...])
            if !frame.isEmpty, let decoded = COBS.decode(Data(frame)) {
                handler?(decoded)
            }
        }
    }
}

/// Transport-level errors.
public enum ConduytTransportError: Error, LocalizedError {
    case notConnected
    case connectionFailed

    public var errorDescription: String? {
        switch self {
        case .notConnected: return "Transport not connected"
        case .connectionFailed: return "Connection failed"
        }
    }
}
