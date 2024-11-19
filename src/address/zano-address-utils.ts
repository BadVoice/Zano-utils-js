import crypto from 'crypto';

import {
  BUFFER_INTEGRATED_ADDRESS_LENGTH,
  INTEGRATED_ADDRESS_REGEX,
  PAYMENT_ID_LENGTH,
  INTEGRATED_ADDRESS_FLAG_PREFIX,
  INTEGRATED_ADDRESS_TAG_PREFIX,
  BUFFER_ADDRESS_LENGTH,
  CHECKSUM_LENGTH,
  FLAG_LENGTH,
  SPEND_KEY_LENGTH,
  TAG_LENGTH,
  VIEW_KEY_LENGTH,
  ADDRESS_REGEX,
} from './constants';
import { ZarcanumAddressKeys } from './types';
import { base58Encode, base58Decode } from '../core/base58';
import { getChecksum } from '../core/crypto';

export class ZanoAddressUtils {

  getIntegratedAddress(address: string): string {
    try {
      const decodedAddress: Buffer = base58Decode(address);

      const tag: number = INTEGRATED_ADDRESS_TAG_PREFIX;
      const flag: number = INTEGRATED_ADDRESS_FLAG_PREFIX;

      let offset = TAG_LENGTH + FLAG_LENGTH;
      const viewPublicKey: Buffer = decodedAddress.subarray(offset, offset + VIEW_KEY_LENGTH);
      offset += VIEW_KEY_LENGTH;
      const spendPublicKey: Buffer = decodedAddress.subarray(offset, offset + SPEND_KEY_LENGTH);
      const paymentId: Buffer = Buffer.from(this.generatePaymentId());

      const integratedAddressBuffer: Buffer = Buffer.concat([
        Buffer.from([tag, flag]),
        viewPublicKey,
        spendPublicKey,
        paymentId,
      ]);

      const checksum: string = getChecksum(integratedAddressBuffer);
      return base58Encode(Buffer.concat([integratedAddressBuffer, Buffer.from(checksum, 'hex')]));
    } catch (error) {
      throw new Error(error.message);
    }
  }

  encodeAddress(tag: number, flag: number, spendPublicKey: string, viewPublicKey: string): string {
    try {
      if (tag < 0) {
        throw new Error('Invalid tag');
      }
      if (flag < 0) {
        throw new Error('Invalid flag');
      }
      let buf: Buffer = Buffer.from([tag, flag]);

      if (spendPublicKey.length !== 64 && !/^([0-9a-fA-F]{2})+$/.test(spendPublicKey)) {
        throw new Error('Invalid spendPublicKey: must be a hexadecimal string with a length of 64');
      }
      const spendKey: Buffer = Buffer.from(spendPublicKey, 'hex');

      if (viewPublicKey.length !== 64 && !/^([0-9a-fA-F]{2})+$/.test(viewPublicKey)) {
        throw new Error('Invalid viewPrivateKey: must be a hexadecimal string with a length of 64');
      }
      const viewKey: Buffer = Buffer.from(viewPublicKey, 'hex');

      buf = Buffer.concat([buf, spendKey, viewKey]);
      const hash: string = getChecksum(buf);

      return base58Encode(Buffer.concat([buf, Buffer.from(hash, 'hex')]));
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /*
   * Retrieves public spend and view keys from the Zano address.
   *
   * This function decodes a Zano address and Integrated address from its Base58 representation and extracts
   * the spend and view keys contained within it. If the address is not in a valid
   * Base58 format, or if the resulting buffer does not conform to expected length specifics,
   * an error is thrown.
   *
   * @param {string} address - A Zano address and Integrated address in Base58 format.
   * @returns { ZarcanumAddressKeys } An object containing the spend and view keys.
   * @throws { Error } Throws an error if the address format or buffer length is invalid.
 */
  getKeysFromAddress(address: string): ZarcanumAddressKeys {
    if (!ADDRESS_REGEX.test(address) && !INTEGRATED_ADDRESS_REGEX.test(address)) {
      throw new Error('Invalid address format');
    }

    const buf: Buffer = base58Decode(address);

    if (buf.length !== BUFFER_ADDRESS_LENGTH && buf.length !== BUFFER_INTEGRATED_ADDRESS_LENGTH) {
      throw new Error('Invalid buffer address length');
    }

    const addressWithoutChecksum: Buffer = Buffer.from(buf.buffer, 0, buf.length - CHECKSUM_LENGTH);
    const checksum: string = Buffer.from(buf.buffer, buf.length - CHECKSUM_LENGTH).toString('hex');

    if (checksum !== getChecksum(addressWithoutChecksum)) {
      throw new Error('Invalid address checksum');
    }

    const spendPublicKey: string = Buffer.from(
      buf.buffer,
      TAG_LENGTH + FLAG_LENGTH,
      SPEND_KEY_LENGTH,
    ).toString('hex');

    const viewPublicKey: string = Buffer.from(
      buf.buffer,
      TAG_LENGTH + FLAG_LENGTH + SPEND_KEY_LENGTH,
      VIEW_KEY_LENGTH,
    ).toString('hex');

    if (!spendPublicKey || spendPublicKey.length !== SPEND_KEY_LENGTH * 2 ||
        !viewPublicKey || viewPublicKey.length !== VIEW_KEY_LENGTH * 2) {
      throw new Error('Invalid key format in the address.');
    }

    return { spendPublicKey, viewPublicKey };
  }

  private generatePaymentId(): string {
    return crypto.randomBytes(PAYMENT_ID_LENGTH).toString('hex');
  }
}
