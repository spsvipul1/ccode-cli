import Yoga, { Node as YogaNode } from 'yoga-layout-prebuilt';

export { YogaNode };

export const createNode = (): YogaNode => Yoga.Node.create();

export const computeLayout = (root: YogaNode, width?: number, height?: number): void => {
  root.calculateLayout(
    width !== undefined ? width : Yoga.UNDEFINED,
    height !== undefined ? height : Yoga.UNDEFINED,
    Yoga.DIRECTION_LTR
  );
};

export default { createNode, computeLayout };
